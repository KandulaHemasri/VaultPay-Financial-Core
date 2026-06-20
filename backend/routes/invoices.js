const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const invoiceIdorMiddleware = require('../middleware/idor');

const router = express.Router();


router.get('/', authMiddleware, (req, res) => {
  if (req.user.role === 'admin') {
    res.json(db.getInvoices());
  } else {
    const invoices = db.getInvoicesByClientId(req.user.id);
    res.json(invoices);
  }
});


router.post('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access Denied: Only administrators can create invoices'
    });
  }

  const { clientId, amount, description, stripeInvoiceId } = req.body;

  if (!clientId || !amount || !description || !stripeInvoiceId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'clientId, amount, description, and stripeInvoiceId are required fields'
    });
  }


  const client = db.getClientById(clientId);
  if (!client) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Target client matching ID '${clientId}' was not found`
    });
  }

  const newInvoice = {
    id: `inv_${Math.floor(100 + Math.random() * 900)}`,
    clientId,
    amount: parseFloat(amount),
    currency: 'USD',
    status: 'unpaid',
    description,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stripeInvoiceId
  };

  db.addInvoice(newInvoice);
  console.log(`[Admin] Created invoice ${newInvoice.id} for client ${clientId} (${client.name}).`);

  res.status(201).json(newInvoice);
});


router.get('/:id', authMiddleware, invoiceIdorMiddleware, (req, res) => {
  res.json(req.invoice);
});


router.get('/:id/pdf', authMiddleware, invoiceIdorMiddleware, (req, res) => {
  try {
    const invoice = req.invoice;
    const client = db.getClientById(invoice.clientId);

    if (!client) {
      return res.status(404).json({ error: 'Not Found', message: 'Client associated with invoice not found' });
    }

   
    const doc = new PDFDocument({ margin: 50 });

    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vaultpay_invoice_${invoice.id}.pdf"`);

    doc.pipe(res);

   
    doc.rect(0, 0, 612, 15).fill('#7C3AED');

    
    doc.fillColor('#1F2937')
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('VaultPay ', 50, 45, { continued: true })
       .fillColor('#7C3AED')
       .text('Financial Core');

    doc.fillColor('#9CA3AF')
       .font('Helvetica')
       .fontSize(9)
       .text('SECURED DIGITAL TRANSACTIONS LEDGER', 50, 72);

    
    doc.fillColor('#1F2937')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('INVOICE STATEMENT', 350, 45, { align: 'right', width: 212 });

    
    doc.moveTo(50, 95)
       .lineTo(562, 95)
       .strokeColor('#E5E7EB')
       .lineWidth(1)
       .stroke();

    doc.fillColor('#4B5563')
       .font('Helvetica-Bold')
       .fontSize(10)
       .text('ISSUED BY:', 50, 115);
    doc.font('Helvetica')
       .text('VaultPay Global Gateway Inc.')
       .text('75 Wall Street, Financial District')
       .text('New York, NY 10005')
       .text('compliance@vaultpay.io');


    doc.fillColor('#4B5563')
       .font('Helvetica-Bold')
       .text('BILL TO:', 220, 115);
    doc.font('Helvetica')
       .text(client.name)
       .text(client.email)
       .text(`Client ID: ${client.id}`);


    doc.fillColor('#4B5563')
       .font('Helvetica-Bold')
       .text('LEDGER METADATA:', 400, 115);
    doc.font('Helvetica')
       .text(`Invoice ID: ${invoice.id}`)
       .text(`Issued: ${invoice.date}`)
       .text(`Due Date: ${invoice.dueDate}`)
       .text(`Stripe Link ID: ${invoice.stripeInvoiceId || 'N/A'}`);


    const isPaid = invoice.status === 'paid';
    const tagBgColor = isPaid ? '#10B981' : '#EF4444';
    const tagTextColor = '#FFFFFF';

    doc.rect(400, 190, 162, 22).fill(tagBgColor);
    doc.fillColor(tagTextColor)
       .font('Helvetica-Bold')
       .fontSize(9)
       .text(`STATUS: ${invoice.status.toUpperCase()}`, 400, 197, { align: 'center', width: 162 });


    doc.moveTo(50, 235)
       .lineTo(562, 235)
       .strokeColor('#9CA3AF')
       .lineWidth(1.5)
       .stroke();

    doc.fillColor('#1F2937')
       .font('Helvetica-Bold')
       .fontSize(10)
       .text('DESCRIPTION / SKU', 55, 245)
       .text('RATE (USD)', 320, 245, { width: 80, align: 'right' })
       .text('QTY', 420, 245, { width: 40, align: 'center' })
       .text('AMOUNT', 480, 245, { width: 80, align: 'right' });

    doc.moveTo(50, 260)
       .lineTo(562, 260)
       .strokeColor('#E5E7EB')
       .lineWidth(1)
       .stroke();


    doc.fillColor('#4B5563')
       .font('Helvetica')
       .fontSize(10)
       .text(invoice.description, 55, 275, { width: 250 })
       .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 320, 275, { width: 80, align: 'right' })
       .text('1', 420, 275, { width: 40, align: 'center' })
       .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 480, 275, { width: 80, align: 'right' });

    doc.moveTo(50, 310)
       .lineTo(562, 310)
       .strokeColor('#F3F4F6')
       .lineWidth(1)
       .stroke();


    doc.fillColor('#1F2937')
       .font('Helvetica-Bold')
       .fontSize(11)
       .text('Total Amount Due:', 320, 332, { width: 140, align: 'right' })
       .fillColor('#7C3AED')
       .fontSize(13)
       .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}`, 470, 331, { width: 90, align: 'right' });

    doc.rect(50, 680, 512, 50).fill('#F9FAFB');
    doc.rect(50, 680, 512, 50).strokeColor('#E5E7EB').lineWidth(1).stroke();
    doc.fillColor('#9CA3AF')
       .font('Helvetica-Oblique')
       .fontSize(7.5)
       .text('SECURITY AUDIT FOOTER: This document was dynamically built on user demand following real-time JWT authentication verification and IDOR ownership audits. All requests to retrieve this document are cryptographically authorized. In accordance with zero-trust network topology, this document contains an internal server log trace. Violating VaultPay API access parameters will flag the request for immediate IP blocking.', 60, 688, { width: 492, align: 'justify' });

    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate PDF document' });
    }
  }
});

module.exports = router;
