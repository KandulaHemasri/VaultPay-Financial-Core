const { fork } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {

  console.log(' VAULTPAY FINANCIAL CORE INTEGRATION SUITE ');
  console.log('Spawning target backend process...');
  
  const server = fork(path.join(__dirname, 'server.js'), {
    env: { 
      ...process.env, 
      PORT: PORT, 
      JWT_SECRET: 'super_secret_vaultpay_key',
      NODE_ENV: 'test'
    },
    stdio: 'inherit'
  });

  server.on('error', (err) => {
    console.error(' Child Process Spawn Error:', err);
  });

  server.on('exit', (code, signal) => {
    console.log(`Child Process Exited: Code=${code}, Signal=${signal}`);
  });

  console.log('Waiting 5 seconds for backend boot sequence...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  let passed = true;
  let clientAToken = null;

  try {
    // TEST 1: Authenticate as Client A (Apex Corp)
    console.log('\n[TEST 1] POST /api/auth/login -> Logging in Client A...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'apex@corp.com', password: 'apex123_secure' })
    });
    
    if (loginRes.status !== 200) {
      throw new Error(`Authentication endpoint rejected credentials, status: ${loginRes.status}`);
    }
    const loginData = await loginRes.json();
    if (!loginData.token) {
      throw new Error('No authorization token present in handshake response');
    }
    clientAToken = loginData.token;
    console.log(' Client A authenticated. Session JWT retrieved.');


    // TEST 2: List Invoices for Client A
    console.log('\n[TEST 2] GET /api/invoices -> Retrieve invoices ledger for Client A...');
    const listRes = await fetch(`${BASE_URL}/api/invoices`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    
    if (listRes.status !== 200) {
      throw new Error(`Failed to list invoices, server status: ${listRes.status}`);
    }
    const invoices = await listRes.json();
    
    if (!Array.isArray(invoices) || invoices.length !== 2) {
      throw new Error(`Invoice list size mismatch. Expected 2, but received: ${invoices.length}`);
    }
    
    invoices.forEach(inv => {
      if (inv.clientId !== '123') {
        throw new Error(`Security Leak: Invoice belongs to client '${inv.clientId}' but was listed for Client A ('123')`);
      }
    });
    console.log('Successfully pulled active client ledger. Zero leak detected.');


    // TEST 3: Retrieve Client A's Authorized Invoice Detail

    console.log('\n[TEST 3] GET /api/invoices/inv_901 -> Reading own invoice detail...');
    const getOwnRes = await fetch(`${BASE_URL}/api/invoices/inv_901`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    
    if (getOwnRes.status !== 200) {
      throw new Error(`Authorized invoice retrieve was rejected. Status: ${getOwnRes.status}`);
    }
    const ownInvoice = await getOwnRes.json();
    if (ownInvoice.id !== 'inv_901') {
      throw new Error(`Invoice content mismatch. Expected 'inv_901', but received: '${ownInvoice.id}'`);
    }
    console.log('Successfully fetched own invoice. Access granted.');


    // TEST 4: IDOR Prevention - Attempt to read Client B's invoice detail

    console.log('\n[TEST 4] GET /api/invoices/inv_903 -> Requesting Client B\'s invoice (IDOR Attack simulation)...');
    const idorRes = await fetch(`${BASE_URL}/api/invoices/inv_903`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    
    console.log(`Response Status: ${idorRes.status}`);
    if (idorRes.status !== 403) {
      throw new Error(`CRITICAL IDOR VULNERABILITY! Expected 403 Forbidden, but server returned: ${idorRes.status}`);
    }
    const idorBody = await idorRes.json();
    if (!idorBody.error || idorBody.error !== 'Forbidden') {
      throw new Error(`Malformed error details in 403 payload: ${JSON.stringify(idorBody)}`);
    }
    console.log('IDOR Attack Blocked by API Firewall. 403 Forbidden returned.');


    // TEST 5: IDOR Prevention - Attempt to download Client B's Invoice PDF

    console.log('\n[TEST 5] GET /api/invoices/inv_903/pdf -> Requesting Client B\'s Invoice PDF (IDOR Document Download simulation)...');
    const idorPdfRes = await fetch(`${BASE_URL}/api/invoices/inv_903/pdf`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    
    console.log(`Response Status: ${idorPdfRes.status}`);
    if (idorPdfRes.status !== 403) {
      throw new Error(`CRITICAL IDOR DOCUMENT LEAK! Expected 403 Forbidden, but server returned: ${idorPdfRes.status}`);
    }
    const idorPdfBody = await idorPdfRes.json();
    if (idorPdfBody.error !== 'Forbidden') {
      throw new Error(`Expected Forbidden error structure on PDF IDOR, got: ${JSON.stringify(idorPdfBody)}`);
    }
    console.log(' IDOR PDF Download Blocked by API Firewall. 403 Forbidden returned.');


    // TEST 6: Stripe Webhook Payment Automation

    console.log('\n[TEST 6] POST /api/webhooks/stripe -> Simulating payment success for Apex Corp inv_902...');
    

    const invBeforeRes = await fetch(`${BASE_URL}/api/invoices/inv_902`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    const invBefore = await invBeforeRes.json();
    if (invBefore.status !== 'unpaid') {
      throw new Error(`Expected invoice inv_902 status to be 'unpaid', but is: '${invBefore.status}'`);
    }
    console.log(`Invoice status prior to webhook: '${invBefore.status}'`);

    const paymentSuccessPayload = {
      id: 'evt_stripe_payment_test_inv_902',
      object: 'event',
      type: 'invoice.payment_succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'in_stripe_apex_02',
          amount: 420050,
          currency: 'usd',
          status: 'paid'
        }
      }
    };

    const crypto = require('crypto');
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stripe_webhook_secret_12345';
    const rawBodyStr = JSON.stringify(paymentSuccessPayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', endpointSecret)
                            .update(`${timestamp}.${rawBodyStr}`)
                            .digest('hex');
    const stripeSignatureHeader = `t=${timestamp},v1=${signature}`;

    const webhookRes = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignatureHeader
      },
      body: rawBodyStr
    });

    if (webhookRes.status !== 200) {
      throw new Error(`Webhook receiver rejected post payload, status: ${webhookRes.status}`);
    }
    console.log('Webhook dispatched to gateway. Verifying database state updates...');


    const invAfterRes = await fetch(`${BASE_URL}/api/invoices/inv_902`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    const invAfter = await invAfterRes.json();
    if (invAfter.status !== 'paid') {
      throw new Error(`Database state update failed! Invoice inv_902 status is still: '${invAfter.status}'`);
    }
    console.log(`Invoice status updated successfully to: '${invAfter.status}'`);


    // TEST 7: PDF Receipt File Generation Verification

    console.log('\n[TEST 7] Checking local filesystem for compiled PDF receipt...');
    const fs = require('fs');
    const receiptPath = path.join(__dirname, 'receipts', 'receipt_inv_902.pdf');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!fs.existsSync(receiptPath)) {
      throw new Error(`PDF Receipt File not found on disk at: ${receiptPath}`);
    }
    
    const stats = fs.statSync(receiptPath);
    if (stats.size === 0) {
      throw new Error(`PDF Receipt File was written but is empty (0 bytes)`);
    }
    console.log(`✅ Dynamically generated PDF receipt located: ${receiptPath} (${stats.size} bytes)`);

    // TEST 8: Authenticate as Admin

    console.log('\n[TEST 8] POST /api/auth/login -> Logging in Admin...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vaultpay.io', password: 'admin123_secure' })
    });
    
    if (adminLoginRes.status !== 200) {
      throw new Error(`Admin authentication rejected, status: ${adminLoginRes.status}`);
    }
    const adminLoginData = await adminLoginRes.json();
    if (!adminLoginData.token) {
      throw new Error('No authorization token present in Admin login response');
    }
    const adminToken = adminLoginData.token;
    console.log(' Admin authenticated. JWT Session established.');


    // TEST 9: Create a new invoice for Client B as Admin

    console.log('\n[TEST 9] POST /api/invoices -> Admin creating new invoice for Client B...');
    const invoicePayload = {
      clientId: '456',
      amount: 3200.00,
      description: 'Audit Consulting Services',
      stripeInvoiceId: 'in_stripe_beta_03'
    };
    
    const createInvoiceRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(invoicePayload)
    });
    
    if (createInvoiceRes.status !== 201) {
      throw new Error(`Failed to create invoice as Admin, status: ${createInvoiceRes.status}`);
    }
    const createdInvoice = await createInvoiceRes.json();
    const createdInvoiceId = createdInvoice.id;
    console.log(`Invoice ${createdInvoiceId} successfully created for Client B by Admin.`);

 
    // TEST 10: Attempt to create an invoice as Client A (IDOR Prevention on Write)
 
    console.log('\n[TEST 10] POST /api/invoices -> Client A attempting to create invoice (Forbidden check)...');
    const unauthorizedCreateRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientAToken}`
      },
      body: JSON.stringify(invoicePayload)
    });
    
    console.log(`Response Status: ${unauthorizedCreateRes.status}`);
    if (unauthorizedCreateRes.status !== 403) {
      throw new Error(`Security Vulnerability: Client allowed to write invoices. Expected 403, got: ${unauthorizedCreateRes.status}`);
    }
    console.log(' Invoice creation denied for non-admin user. 403 Forbidden returned.');


    // TEST 11: Access check: Client B can see new invoice, Client A cannot
   
    console.log('\n[TEST 11] GET /api/invoices -> Verifying role-based segregation for new invoice...');
    

    const clientBLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'beta@solutions.com', password: 'beta456_secure' })
    });
    const clientBLoginData = await clientBLoginRes.json();
    const clientBToken = clientBLoginData.token;
    
    // Fetch Client B invoices
    const clientBInvoicesRes = await fetch(`${BASE_URL}/api/invoices`, {
      headers: { 'Authorization': `Bearer ${clientBToken}` }
    });
    const clientBInvoices = await clientBInvoicesRes.json();
    const clientBHasInvoice = clientBInvoices.some(inv => inv.id === createdInvoiceId);
    
    if (!clientBHasInvoice) {
      throw new Error(`Target Client B could not find the newly created invoice '${createdInvoiceId}' in their ledger`);
    }
    console.log(' Client B successfully reads their new invoice.');


    const clientAInvoicesRes = await fetch(`${BASE_URL}/api/invoices`, {
      headers: { 'Authorization': `Bearer ${clientAToken}` }
    });
    const clientAInvoices = await clientAInvoicesRes.json();
    const clientAHasInvoice = clientAInvoices.some(inv => inv.id === createdInvoiceId);
    
    if (clientAHasInvoice) {
      throw new Error(`Security Leak: Client A was able to list Client B's invoice '${createdInvoiceId}'`);
    }
    console.log(' Client A cannot list Client B\'s invoice. Zero-Trust confirmed.');

  } catch (err) {
    console.error(`\n Integration Suite Failed: ${err.message}`);
    passed = false;
  } finally {
    console.log('\n Shutting down backend process...');
    server.kill();
  }

  console.log('\n');
  if (passed) {
    console.log(' AUDIT SUCCESS: ZERO-TRUST IDOR INTERCEPTION AND   ');
    console.log('   STRIPE WEBHOOK HANDLINGS VALIDATED CORRECTLY!     ');

    process.exit(0);
  } else {
    console.log(' AUDIT FAILURE: System failed security benchmarks. ');
    process.exit(1);
  }
}

runTests();
