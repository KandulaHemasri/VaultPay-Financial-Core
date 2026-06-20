
const clients = {
  "123": {
    id: "123",
    name: "Apex Corp",
    email: "apex@corp.com",
    password: "apex123_secure",
    role: "client"
  },
  "456": {
    id: "456",
    name: "Beta Solutions",
    email: "beta@solutions.com",
    password: "beta456_secure",
    role: "client"
  }
};

const admins = {
  "admin_01": {
    id: "admin_01",
    name: "System Admin",
    email: "admin@vaultpay.io",
    password: "admin123_secure",
    role: "admin"
  }
};

const invoices = [
  {
    id: "inv_901",
    clientId: "123",
    amount: 1500.00,
    currency: "USD",
    status: "paid",
    description: "Enterprise Cloud Subscription - May 2026",
    date: "2026-05-01",
    dueDate: "2026-05-15",
    stripeInvoiceId: "in_stripe_apex_01"
  },
  {
    id: "inv_902",
    clientId: "123",
    amount: 4200.50,
    currency: "USD",
    status: "unpaid",
    description: "Consulting & Architecture Design Services",
    date: "2026-06-10",
    dueDate: "2026-07-10",
    stripeInvoiceId: "in_stripe_apex_02"
  },
  {
    id: "inv_903",
    clientId: "456",
    amount: 750.00,
    currency: "USD",
    status: "paid",
    description: "Database Migration Consultancy",
    date: "2026-05-18",
    dueDate: "2026-06-01",
    stripeInvoiceId: "in_stripe_beta_01"
  },
  {
    id: "inv_904",
    clientId: "456",
    amount: 9800.00,
    currency: "USD",
    status: "unpaid",
    description: "VaultPay Gateway Integration Services",
    date: "2026-06-15",
    dueDate: "2026-07-15",
    stripeInvoiceId: "in_stripe_beta_02"
  }
];

const webhookLogs = [];


module.exports = {
  getClients: () => Object.values(clients),
  getClientById: (id) => clients[id],
  getClientByEmail: (email) => Object.values(clients).find(c => c.email === email),
  
  getAdminById: (id) => admins[id],
  getAdminByEmail: (email) => Object.values(admins).find(a => a.email === email),
  
  getInvoices: () => invoices,
  getInvoiceById: (id) => invoices.find(inv => inv.id === id),
  getInvoicesByClientId: (clientId) => invoices.filter(inv => inv.clientId === clientId),
  
  addInvoice: (invoice) => {
    invoices.push(invoice);
    return invoice;
  },
  
  updateInvoiceStatusByStripeId: (stripeInvoiceId, status) => {
    const invoice = invoices.find(inv => inv.stripeInvoiceId === stripeInvoiceId);
    if (invoice) {
      invoice.status = status;
      return invoice;
    }
    return null;
  },
  
  logWebhookEvent: (event) => {
    webhookLogs.unshift({
      timestamp: new Date().toISOString(),
      id: event.id,
      type: event.type,
      data: event.data
    });
  },
  
  getWebhookLogs: () => webhookLogs
};
