const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('[Mailer] Connecting to SMTP Server:', process.env.SMTP_HOST);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return transporter;
  }

  console.log('[Mailer] Generating sandbox Ethereal SMTP test account...');
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
  return transporter;
}

/**
 * Emails a paid invoice receipt PDF as a secure attachment.
 * @param {Object} client The client database entry.
 * @param {Object} invoice The invoice database entry.
 * @param {string} attachmentPath The absolute path to the PDF receipt.
 * @returns {Promise<Object>} Object containing delivery status and Ethereal preview URLs (if testing).
 */
async function sendReceipt(client, invoice, attachmentPath) {
  try {
    const activeTransporter = await getTransporter();

    const mailOptions = {
      from: '"Nexus Corporate Billing" <billing@nexuscorporate.io>',
      to: client.email,
      subject: `Payment Settled - Nexus Corporate Receipt #${invoice.id}`,
      text: `Hello ${client.name},\n\nWe are pleased to confirm that payment for invoice ${invoice.id} was processed successfully.\n\nPlease find attached your official payment receipt from Nexus Corporate.\n\nThank you for choosing Nexus Corporate Solutions.\n\nBest regards,\nNexus Corporate Solutions Billing Gateway`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">Payment Confirmed</h2>
          <p>Hello <b>${client.name}</b>,</p>
          <p>This email confirms that your payment of <b>$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}</b> for invoice <b>${invoice.id}</b> has been settled successfully.</p>
          <p>We have dynamically generated and attached your official PDF payment receipt for your records. It contains the Nexus Corporate branding and proof-of-settlement markings.</p>
          <br/>
          <p>Thank you for your business!</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; font-style: italic;">This is an automated transaction verification notification. Please do not reply directly to this mail.</p>
        </div>
      `,
      attachments: [
        {
          filename: `nexus_receipt_${invoice.id}.pdf`,
          path: attachmentPath
        }
      ]
    };

    console.log(`[Mailer] Dispatching receipt email to ${client.email}...`);
    const info = await activeTransporter.sendMail(mailOptions);
    

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Mailer] Dispatch complete! Ethereal Email Preview URL: ${previewUrl}`);
      return { success: true, previewUrl, messageId: info.messageId };
    }

    console.log(`[Mailer] Dispatch complete! SMTP Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Delivery Failed:', err.message);
    throw err;
  }
}

module.exports = { sendReceipt };
