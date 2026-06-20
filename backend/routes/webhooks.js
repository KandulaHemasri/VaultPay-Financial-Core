const express = require('express');
const crypto = require('crypto');
const stripe = require('stripe')('sk_test_mock_stripe_key_12345');
const db = require('../db');
const pdfGenerator = require('../services/pdfGenerator');
const mailer = require('../services/mailer');

const router = express.Router();


router.post('/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stripe_webhook_secret_12345';

  if (!sig) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing Stripe-Signature header'
    });
  }

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`[Webhook] Signature Verification Failed: ${err.message}`);
    return res.status(400).json({
      error: 'Forbidden',
      message: `Signature verification failed: ${err.message}`
    });
  }


  db.logWebhookEvent(event);
  console.log(`[Webhook] Cryptographically Verified Event - ID: ${event.id}, Type: ${event.type}`);


  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const stripeInvoiceObj = event.data.object;
      const stripeInvoiceId = stripeInvoiceObj.id;
      
      const updatedInvoice = db.updateInvoiceStatusByStripeId(stripeInvoiceId, 'paid');
      
      if (updatedInvoice) {
        console.log(`[Webhook] Invoice ${updatedInvoice.id} (${stripeInvoiceId}) was marked PAID successfully.`);
        
        const client = db.getClientById(updatedInvoice.clientId);
        if (client) {
        
          pdfGenerator.generateReceipt(updatedInvoice, client)
            .then(async (pdfPath) => {
              console.log(`[Webhook] PDF Receipt compiled: ${pdfPath}`);
              try {
                const mailInfo = await mailer.sendReceipt(client, updatedInvoice, pdfPath);
                const logDetail = mailInfo.previewUrl
                  ? `Email sent. Sandbox View: ${mailInfo.previewUrl}`
                  : `Email sent. Message ID: ${mailInfo.messageId}`;
                
                console.log(`[Webhook] Email dispatched: ${logDetail}`);
                
                db.logWebhookEvent({
                  id: `evt_mail_${Math.random().toString(36).substr(2, 9)}`,
                  type: 'email.sent',
                  timestamp: new Date().toISOString(),
                  data: {
                    object: {
                      id: updatedInvoice.stripeInvoiceId,
                      amount: updatedInvoice.amount * 100,
                      email: client.email,
                      previewUrl: mailInfo.previewUrl || null,
                      logDetail: logDetail
                    }
                  }
                });
              } catch (mailErr) {
                console.error(`[Webhook] Email delivery failed: ${mailErr.message}`);
              }
            })
            .catch((pdfErr) => {
              console.error(`[Webhook] PDF compilation failed: ${pdfErr.message}`);
            });
        }
      } else {
        console.log(`[Webhook] Warning: Received invoice.payment_succeeded for unknown Stripe Invoice ID: ${stripeInvoiceId}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const stripeInvoiceObj = event.data.object;
      const stripeInvoiceId = stripeInvoiceObj.id;

      const updatedInvoice = db.updateInvoiceStatusByStripeId(stripeInvoiceId, 'unpaid');
      
      if (updatedInvoice) {
        console.log(`[Webhook] Invoice ${updatedInvoice.id} (${stripeInvoiceId}) was marked UNPAID (payment failed).`);
      } else {
        console.log(`[Webhook] Warning: Received invoice.payment_failed for unknown Stripe Invoice ID: ${stripeInvoiceId}`);
      }
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }


  res.status(200).json({ received: true });
});


router.post('/simulate-stripe-pay', express.json(), async (req, res) => {
  const { stripeInvoiceId, amountVal } = req.body;

  if (!stripeInvoiceId || !amountVal) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'stripeInvoiceId and amountVal are required'
    });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stripe_webhook_secret_12345';
  

  const webhookEvent = {
    id: `evt_mock_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    type: 'invoice.payment_succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: stripeInvoiceId,
        amount: Math.round(amountVal * 100),
        currency: 'usd',
        customer: 'cus_test_cust123',
        status: 'paid'
      }
    }
  };

  const rawBodyStr = JSON.stringify(webhookEvent);
  const timestamp = Math.floor(Date.now() / 1000);
  

  const signature = crypto.createHmac('sha256', endpointSecret)
                          .update(`${timestamp}.${rawBodyStr}`)
                          .digest('hex');
                          
  const stripeSignatureHeader = `t=${timestamp},v1=${signature}`;
  

  try {
    const PORT = req.socket.localPort || process.env.PORT || 3000;
    
    const forwardRes = await fetch(`http://localhost:${PORT}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignatureHeader
      },
      body: rawBodyStr
    });

    const bodyText = await forwardRes.text();
    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch(e) {
      bodyJson = { raw: bodyText };
    }

    return res.status(forwardRes.status).json(bodyJson);
  } catch (err) {
    console.error('[Simulator] Forwarding failed:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: `Failed to forward simulated payload to stripe receiver: ${err.message}`
    });
  }
});


router.get('/logs', (req, res) => {
  res.json(db.getWebhookLogs());
});

module.exports = router;
