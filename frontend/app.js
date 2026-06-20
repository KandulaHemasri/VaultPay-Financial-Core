// VaultPay Financial Core Dashboard Client Controller

// Change this to your deployed Render backend URL when deploying to Vercel
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://vaultpay-financial-core-o8j0.onrender.com'; 

// Session State
let token = sessionStorage.getItem('vaultpay_jwt') || null;
let activeClient = JSON.parse(sessionStorage.getItem('vaultpay_client')) || null;

function populateIdorDropdown(invoices) {
  if (!idorInvoiceIdSelect || !invoices) return;
  idorInvoiceIdSelect.innerHTML = '';
  invoices.forEach(inv => {
    const clientName = inv.clientId === '123' ? 'Client A' : (inv.clientId === '456' ? 'Client B' : `Client ${inv.clientId}`);
    const opt = document.createElement('option');
    opt.value = inv.id;
    opt.textContent = `${inv.id} (Belongs to ${clientName})`;
    idorInvoiceIdSelect.appendChild(opt);
  });
}

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardApp = document.getElementById('dashboardApp');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

const loginClientABtn = document.getElementById('loginClientA');
const loginClientBBtn = document.getElementById('loginClientB');
const loginAdminBtn = document.getElementById('loginAdmin');
const logoutBtn = document.getElementById('logoutBtn');
const sessionInfoBlock = document.getElementById('sessionInfoBlock');
const activeClientNameEl = document.getElementById('activeClientName');
const activeClientIdEl = document.getElementById('activeClientId');
const activeClientTokenEl = document.getElementById('activeClientToken');
const securityBadge = document.getElementById('securityBadge');
const securityBadgeText = document.getElementById('securityBadgeText');

const adminPanelCard = document.getElementById('adminPanelCard');
const createInvoiceForm = document.getElementById('createInvoiceForm');
const invClientIdSelect = document.getElementById('invClientId');
const invAmountInput = document.getElementById('invAmount');
const invDescriptionInput = document.getElementById('invDescription');
const invStripeIdInput = document.getElementById('invStripeId');

const idorInvoiceIdSelect = document.getElementById('idorInvoiceId');
const btnAttackApi = document.getElementById('btnAttackApi');
const btnAttackPdf = document.getElementById('btnAttackPdf');
const consoleLogs = document.getElementById('consoleLogs');

const btnSimulateWebhookApex = document.getElementById('btnSimulateWebhookApex');
const btnSimulateWebhookBeta = document.getElementById('btnSimulateWebhookBeta');

const invoicesPlaceholder = document.getElementById('invoicesPlaceholder');
const invoicesList = document.getElementById('invoicesList');
const btnRefreshInvoices = document.getElementById('btnRefreshInvoices');

const webhookLogsList = document.getElementById('webhookLogsList');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');

// Stripe Modal Elements
const checkoutModal = document.getElementById('checkoutModal');
const btnCancelPayment = document.getElementById('btnCancelPayment');
const checkoutDesc = document.getElementById('checkoutDesc');
const checkoutAmount = document.getElementById('checkoutAmount');
const cardEmail = document.getElementById('cardEmail');
const stripePaymentForm = document.getElementById('stripePaymentForm');
const cardNumberInput = document.getElementById('cardNumber');
const cardExpiryInput = document.getElementById('cardExpiry');
const cardCvcInput = document.getElementById('cardCvc');
const btnSubmitStripePayment = document.getElementById('btnSubmitStripePayment');
const btnStripeText = document.getElementById('btnStripeText');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  updateAuthenticationUI();
  fetchWebhookLogs();
  
  if (token) {
    fetchInvoices();
  }
});

// Event Listeners
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  login(email, password);
});

loginClientABtn.addEventListener('click', () => login('apex@corp.com', 'apex123_secure'));
loginClientBBtn.addEventListener('click', () => login('beta@solutions.com', 'beta456_secure'));
loginAdminBtn.addEventListener('click', () => login('admin@vaultpay.io', 'admin123_secure'));
logoutBtn.addEventListener('click', logout);

btnRefreshInvoices.addEventListener('click', fetchInvoices);
btnRefreshLogs.addEventListener('click', fetchWebhookLogs);

btnSimulateWebhookApex.addEventListener('click', () => simulateStripePaymentSuccess('in_stripe_apex_02', 4200.50));
btnSimulateWebhookBeta.addEventListener('click', () => simulateStripePaymentSuccess('in_stripe_beta_02', 9800.00));

btnAttackApi.addEventListener('click', runIdorApiAttack);
btnAttackPdf.addEventListener('click', runIdorPdfAttack);

// Admin Invoice Creation Handler
createInvoiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!token || activeClient?.role !== 'admin') return;
  
  const clientId = invClientIdSelect.value;
  const amount = invAmountInput.value;
  const description = invDescriptionInput.value;
  const stripeInvoiceId = invStripeIdInput.value;
  
  logConsole(`[Admin] Initiating creation of invoice for client ${clientId}...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ clientId, amount, description, stripeInvoiceId })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invoice creation failed');
    
    logConsole(`[Admin] Success! Created invoice ${data.id} for client ${clientId}.`);
    alert(`Invoice created: ${data.id}`);
    
    createInvoiceForm.reset();
    fetchInvoices();
  } catch (err) {
    logConsole(`[Admin] Invoice Creation Error: ${err.message}`, 'error');
    alert(`Failed to create invoice: ${err.message}`);
  }
});

// Stripe Modal Controls
btnCancelPayment.addEventListener('click', () => {
  checkoutModal.classList.add('hidden');
  currentCheckoutInvoice = null;
});

// Card inputs formatters
cardNumberInput.addEventListener('input', (e) => {
  let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  let formatted = '';
  for (let i = 0; i < val.length; i++) {
    if (i > 0 && i % 4 === 0) formatted += ' ';
    formatted += val[i];
  }
  e.target.value = formatted.substring(0, 19);
});

cardExpiryInput.addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '');
  if (val.length >= 2) {
    e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
  } else {
    e.target.value = val;
  }
});

cardCvcInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
});

let currentCheckoutInvoice = null;

window.openStripeCheckout = function(invoiceId, description, amount, stripeInvoiceId) {
  currentCheckoutInvoice = { invoiceId, description, amount, stripeInvoiceId };
  
  checkoutDesc.textContent = description;
  checkoutAmount.textContent = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  cardEmail.value = activeClient ? activeClient.email : '';
  btnStripeText.textContent = `Pay $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  cardNumberInput.value = '';
  cardExpiryInput.value = '';
  cardCvcInput.value = '';
  btnSubmitStripePayment.disabled = false;
  
  checkoutModal.classList.remove('hidden');
};

stripePaymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentCheckoutInvoice) return;
  
  const cardNumber = cardNumberInput.value.replace(/\s+/g, '');
  if (cardNumber !== '4242424242424242') {
    alert('Invalid card number. Please use the test card 4242 4242 4242 4242.');
    return;
  }
  
  btnSubmitStripePayment.disabled = true;
  btnStripeText.textContent = 'Processing payment...';
  
  logConsole(`[Stripe Checkout] Credit card authorized. Initiating Stripe payment flow...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/webhooks/simulate-stripe-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stripeInvoiceId: currentCheckoutInvoice.stripeInvoiceId,
        amountVal: currentCheckoutInvoice.amount
      })
    });
    
    if (res.ok) {
      logConsole(`[Stripe Checkout] Webhook simulation completed. Invoice paid!`);
      checkoutModal.classList.add('hidden');
      currentCheckoutInvoice = null;
      
      fetchWebhookLogs();
      if (token) fetchInvoices();
    } else {
      const errText = await res.text();
      logConsole(`[Stripe Checkout] Payment failed: ${res.status} - ${errText}`, 'error');
      alert(`Payment failed: ${errText}`);
      btnSubmitStripePayment.disabled = false;
      btnStripeText.textContent = `Pay $${currentCheckoutInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    logConsole(`[Stripe Checkout] Network Error: ${err.message}`, 'error');
    alert(`Network error during payment submission: ${err.message}`);
    btnSubmitStripePayment.disabled = false;
    btnStripeText.textContent = `Pay $${currentCheckoutInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
});

// Authentication Logic
async function login(email, password) {
  logConsole(`Initiating secure authentication handshake for: ${email}...`);
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Authentication failed');

    token = data.token;
    activeClient = data.client;

    sessionStorage.setItem('vaultpay_jwt', token);
    sessionStorage.setItem('vaultpay_client', JSON.stringify(activeClient));

    logConsole(`Success! JWT Session established. Client UUID: ${activeClient.id}`);
    updateAuthenticationUI();
    fetchInvoices();
  } catch (err) {
    logConsole(`Authentication Error: ${err.message}`, 'error');
    alert(`Login failed: ${err.message}`);
  }
}

function logout() {
  token = null;
  activeClient = null;
  sessionStorage.removeItem('vaultpay_jwt');
  sessionStorage.removeItem('vaultpay_client');
  
  logConsole('Client session cleared. Token revoked.');
  updateAuthenticationUI();
}

function updateAuthenticationUI() {
  if (token && activeClient) {
    // Hide login screen, show dashboard
    loginPage.classList.add('hidden');
    dashboardApp.classList.remove('hidden');

    // Preset Buttons highlight state (if visible)
    if (activeClient.role === 'admin') {
      loginAdminBtn.classList.add('active');
      loginClientABtn.classList.remove('active');
      loginClientBBtn.classList.remove('active');
    } else if (activeClient.id === '123') {
      loginClientABtn.classList.add('active');
      loginClientBBtn.classList.remove('active');
      loginAdminBtn.classList.remove('active');
    } else {
      loginClientBBtn.classList.add('active');
      loginClientABtn.classList.remove('active');
      loginAdminBtn.classList.remove('active');
    }

    // Info panel
    sessionInfoBlock.classList.remove('hidden');
    activeClientNameEl.textContent = activeClient.name;
    activeClientIdEl.textContent = activeClient.id;
    
    // Obfuscate token for display
    const visibleLength = 12;
    activeClientTokenEl.textContent = token.substring(0, visibleLength) + '...' + token.substring(token.length - visibleLength);
    activeClientTokenEl.title = token;

    // Badge
    securityBadge.className = 'security-badge secure';
    if (activeClient.role === 'admin') {
      securityBadgeText.textContent = 'SECURE SESSION: ADMINISTRATOR';
      adminPanelCard.classList.remove('hidden');
    } else {
      securityBadgeText.textContent = `SECURE SESSION: CLIENT ${activeClient.id === '123' ? 'A' : 'B'}`;
      adminPanelCard.classList.add('hidden');
    }
    const dot = securityBadge.querySelector('.badge-dot');
    dot.className = 'badge-dot pulse-green';

    // Show tables
    invoicesPlaceholder.classList.add('hidden');
    invoicesList.classList.remove('hidden');
  } else {
    // Show login screen, hide dashboard
    loginPage.classList.remove('hidden');
    dashboardApp.classList.add('hidden');

    // Reset login form inputs
    loginEmail.value = '';
    loginPassword.value = '';

    loginClientABtn.classList.remove('active');
    loginClientBBtn.classList.remove('active');
    loginAdminBtn.classList.remove('active');
    sessionInfoBlock.classList.add('hidden');
    adminPanelCard.classList.add('hidden');
    
    securityBadge.className = 'security-badge';
    securityBadgeText.textContent = 'UNAUTHENTICATED';
    const dot = securityBadge.querySelector('.badge-dot');
    dot.className = 'badge-dot pulse-red';

    invoicesPlaceholder.classList.remove('hidden');
    invoicesList.classList.add('hidden');
    invoicesList.innerHTML = '';
    if (idorInvoiceIdSelect) idorInvoiceIdSelect.innerHTML = '';
  }
}

// Invoices Fetching Logic
async function fetchInvoices() {
  if (!token) return;
  logConsole(`Fetching invoice records from GET /api/invoices ledger...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/invoices`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401) logout();
      const errData = await res.json();
      throw new Error(errData.message || 'Failed to pull invoices');
    }

    const invoices = await res.json();
    renderInvoicesList(invoices);
    logConsole(`Ledger Synchronization: Pulled ${invoices.length} invoices successfully.`);
  } catch (err) {
    logConsole(`Invoices Pull Error: ${err.message}`, 'error');
  }
}

function renderInvoicesList(invoices) {
  invoicesList.innerHTML = '';
  
  if (invoices.length === 0) {
    invoicesList.innerHTML = '<div class="log-placeholder">No active invoices found in this account ledger.</div>';
    populateIdorDropdown([]);
    return;
  }

  invoices.forEach(inv => {
    const card = document.createElement('div');
    card.className = 'invoice-card';
    
    const isPaid = inv.status === 'paid';
    const isAdmin = activeClient?.role === 'admin';
    
    let buttonsHtml = '';
    if (isAdmin) {
      if (isPaid) {
        buttonsHtml = `
          <button class="btn btn-download btn-sm" onclick="downloadInvoicePdf('${inv.id}')">
            \u{1F4E5} Download PDF
          </button>
        `;
      } else {
        buttonsHtml = '';
      }
    } else {
      if (isPaid) {
        buttonsHtml = `
          <button class="btn btn-download btn-sm" onclick="downloadInvoicePdf('${inv.id}')">
            \u{1F4E5} Download PDF
          </button>
        `;
      } else {
        buttonsHtml = `
          <div class="btn-group-row" style="margin-top: 0; gap: 0.5rem;">
            <button class="btn btn-download btn-sm" onclick="downloadInvoicePdf('${inv.id}')">
              \u{1F4E5} PDF
            </button>
            <button class="btn btn-cyan btn-sm" style="background-color: var(--cyan); color: #000;" onclick="openStripeCheckout('${inv.id}', '${inv.description.replace(/'/g, "\\'")}', ${inv.amount}, '${inv.stripeInvoiceId}')">
              \u{1F4B3} Pay
            </button>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="inv-main">
        <div class="inv-header-row">
          <span class="inv-id">${inv.id}</span>
          <span class="inv-status-tag ${isPaid ? 'paid' : 'unpaid'}">${inv.status}</span>
        </div>
        <div class="inv-desc">${inv.description}</div>
        <div class="inv-dates">Issued: ${inv.date} | Due: ${inv.dueDate}</div>
      </div>
      <div class="inv-pricing">
        <span class="inv-amount">$${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        ${buttonsHtml}
      </div>
    `;
    invoicesList.appendChild(card);
  });

  populateIdorDropdown(invoices);
}

// Webhook Logs Fetching & Simulator Logic
async function fetchWebhookLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/webhooks/logs`);
    if (!res.ok) throw new Error('Could not pull logs');
    const logs = await res.json();
    
    renderWebhookLogs(logs);
  } catch (err) {
    console.error('Logs fetch error:', err);
  }
}

function renderWebhookLogs(logs) {
  webhookLogsList.innerHTML = '';

  if (logs.length === 0) {
    webhookLogsList.innerHTML = '<div class="log-placeholder">No inbound webhook payloads recorded.</div>';
    return;
  }

  logs.forEach(log => {
    const logDiv = document.createElement('div');
    
    let stateClass = '';
    if (log.type === 'invoice.payment_succeeded') stateClass = 'payment-success';
    if (log.type === 'invoice.payment_failed') stateClass = 'payment-failed';
    
    logDiv.className = `log-item ${stateClass}`;
    
    const time = new Date(log.timestamp).toLocaleTimeString();
    
    logDiv.innerHTML = `
      <div class="log-row-header">
        <span class="log-type">${log.type}</span>
        <span class="log-time">${time}</span>
      </div>
      <div class="log-detail">ID: ${log.id}</div>
      <div class="log-detail">Stripe Inv: ${log.data.object.id} (${log.data.object.amount / 100} USD)</div>
    `;
    webhookLogsList.appendChild(logDiv);
  });
}

async function simulateStripePaymentSuccess(stripeInvoiceId, amountVal) {
  logConsole(`Stripe Sandbox: Dispatching simulation request to backend for '${stripeInvoiceId}'...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/webhooks/simulate-stripe-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stripeInvoiceId, amountVal })
    });

    if (res.ok) {
      logConsole(`Simulation cryptographically signed and resolved successfully.`);
      fetchWebhookLogs();
      if (token) fetchInvoices();
    } else {
      const errText = await res.text();
      logConsole(`Simulation Failed: ${res.status} - ${errText}`, 'error');
    }
  } catch (err) {
    logConsole(`Simulation Dispatch Error: ${err.message}`, 'error');
  }
}

// PDF Secure Download Function (accessible globally)
window.downloadInvoicePdf = async function(invoiceId) {
  if (!token) return;
  logConsole(`Secure Document Download: Requesting PDF stream for invoice '${invoiceId}'...`);
  
  try {
    const res = await fetch(`${API_BASE}/api/invoices/${invoiceId}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Unauthorized download request');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultpay_invoice_${invoiceId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    logConsole(`Document Download Completed: 'vaultpay_invoice_${invoiceId}.pdf' downloaded successfully.`);
  } catch (err) {
    logConsole(`PDF Download Error: ${err.message}`, 'error');
    alert(`Download failed: ${err.message}`);
  }
};

// IDOR Testing Handlers
async function runIdorApiAttack() {
  const targetInvoiceId = idorInvoiceIdSelect.value;
  logConsole(`[IDOR ATTACK SIMULATOR] Dispatching request: GET /api/invoices/${targetInvoiceId}`);
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/invoices/${targetInvoiceId}`, { headers });
    const status = res.status;
    const bodyText = await res.text();
    
    // Output formatted details on the screen console
    let cleanJson;
    try {
      cleanJson = JSON.stringify(JSON.parse(bodyText), null, 2);
    } catch(e) {
      cleanJson = bodyText;
    }
    
    if (status === 200) {
      logConsole(`ATTACK OUTCOME: SUCCESS (Vulnerable!)\nStatus: ${status} OK\nResponse:\n${cleanJson}`, 'vuln');
    } else if (status === 403) {
      logConsole(`ATTACK OUTCOME: BLOCKED BY FIREWALL (Zero-Trust Active)\nStatus: 403 Forbidden\nResponse:\n${cleanJson}`, 'success_defense');
    } else {
      logConsole(`ATTACK OUTCOME: EXCEPTION\nStatus: ${status}\nResponse:\n${cleanJson}`, 'error');
    }
  } catch (err) {
    logConsole(`ATTACK ROUTING ERROR: ${err.message}`, 'error');
  }
}

async function runIdorPdfAttack() {
  const targetInvoiceId = idorInvoiceIdSelect.value;
  logConsole(`[IDOR ATTACK SIMULATOR] Dispatching PDF request: GET /api/invoices/${targetInvoiceId}/pdf`);
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/invoices/${targetInvoiceId}/pdf`, { headers });
    const status = res.status;
    const contentType = res.headers.get('content-type');
    
    if (status === 200 && contentType && contentType.includes('application/pdf')) {
      logConsole(`ATTACK OUTCOME: SUCCESS (Vulnerable!)\nStatus: 200 OK (Streamed PDF file)`, 'vuln');
      
      // Trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VULNERABLE_pdf_download_${targetInvoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      const errText = await res.text();
      let cleanJson;
      try {
        cleanJson = JSON.stringify(JSON.parse(errText), null, 2);
      } catch(e) {
        cleanJson = errText;
      }

      if (status === 403) {
        logConsole(`ATTACK OUTCOME: BLOCKED BY FIREWALL (Zero-Trust Active)\nStatus: 403 Forbidden\nResponse:\n${cleanJson}`, 'success_defense');
      } else {
        logConsole(`ATTACK OUTCOME: EXCEPTION\nStatus: ${status}\nResponse:\n${cleanJson}`, 'error');
      }
    }
  } catch (err) {
    logConsole(`ATTACK ROUTING ERROR: ${err.message}`, 'error');
  }
}

// Console helper
function logConsole(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let styledMsg = `[${timestamp}] `;
  
  if (type === 'error') {
    styledMsg += `\u{274C} ERROR: ${message}`;
  } else if (type === 'vuln') {
    styledMsg += `\u{26A0}\u{FE0F} ALERT: ${message}`;
  } else if (type === 'success_defense') {
    styledMsg += `\u{1F6E1}\u{FE0F} SHIELD: ${message}`;
  } else {
    styledMsg += `\u{2139}\u{FE0F} LOG: ${message}`;
  }
  
  consoleLogs.textContent += '\n' + styledMsg;
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
  console.log(styledMsg);
}
