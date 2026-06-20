const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Dynamically compiles a professional PDF payment receipt.
 * @param {Object} invoice The invoice database entry.
 * @param {Object} client The client database entry.
 * @returns {Promise<string>} Resolves with the absolute path of the generated PDF file.
 */
function generateReceipt(invoice, client) {
  return new Promise((resolve, reject) => {
    try {
      const receiptsDir = path.join(__dirname, '../receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      const fileName = `receipt_${invoice.id}.pdf`;
      const filePath = path.join(receiptsDir, fileName);
      
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);
      
      doc.pipe(writeStream);

      doc.rect(0, 0, 612, 15).fill('#3B82F6');

      doc.moveTo(50, 40)
         .lineTo(75, 80)
         .lineTo(50, 80)
         .closePath()
         .fill('#2563EB');
         
      doc.moveTo(60, 40)
         .lineTo(85, 80)
         .lineTo(85, 40)
         .closePath()
         .fill('#06B6D4');

      doc.fillColor('#1E293B')
         .font('Helvetica-Bold')
         .fontSize(22)
         .text('NEXUS ', 100, 45, { continued: true })
         .fillColor('#4B5563')
         .text('Corporate');

      doc.fillColor('#9CA3AF')
         .font('Helvetica')
         .fontSize(8.5)
         .text('GLOBAL SOLUTIONS PLATFORM RECEIPT', 100, 70);

      doc.fillColor('#1E293B')
         .font('Helvetica-Bold')
         .fontSize(16)
         .text('PAYMENT RECEIPT', 350, 45, { align: 'right', width: 212 });

      doc.moveTo(50, 95)
         .lineTo(562, 95)
         .strokeColor('#E5E7EB')
         .lineWidth(1)
         .stroke();


      doc.fillColor('#4B5563')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('MERCHANT LEDGER:', 50, 115);
      doc.font('Helvetica')
         .text('Nexus Corporate Solutions Inc.')
         .text('100 Nexus Parkway, Innovation Hub')
         .text('billing@nexuscorporate.io');


      doc.fillColor('#4B5563')
         .font('Helvetica-Bold')
         .text('CLIENT BILL TO:', 220, 115);
      doc.font('Helvetica')
         .text(client.name)
         .text(client.email)
         .text(`Client Reference ID: ${client.id}`);


      doc.fillColor('#4B5563')
         .font('Helvetica-Bold')
         .text('RECEIPT METADATA:', 400, 115);
      doc.font('Helvetica')
         .text(`Invoice ID: ${invoice.id}`)
         .text(`Issue Date: ${invoice.date}`)
         .text(`Payment Date: ${new Date().toISOString().split('T')[0]}`)
         .text(`Stripe TX Link: ${invoice.stripeInvoiceId || 'N/A'}`);


      doc.moveTo(50, 210)
         .lineTo(562, 210)
         .strokeColor('#9CA3AF')
         .lineWidth(1.5)
         .stroke();

      doc.fillColor('#1E293B')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('DESCRIPTION / PACKAGE', 55, 220)
         .text('RATE (USD)', 320, 220, { width: 80, align: 'right' })
         .text('QTY', 420, 220, { width: 40, align: 'center' })
         .text('AMOUNT', 480, 220, { width: 80, align: 'right' });

      doc.moveTo(50, 235)
         .lineTo(562, 235)
         .strokeColor('#E5E7EB')
         .lineWidth(1)
         .stroke();

      doc.fillColor('#4B5563')
         .font('Helvetica')
         .fontSize(10)
         .text(invoice.description, 55, 250, { width: 250 })
         .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 320, 250, { width: 80, align: 'right' })
         .text('1', 420, 250, { width: 40, align: 'center' })
         .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 480, 250, { width: 80, align: 'right' });

      doc.moveTo(50, 280)
         .lineTo(562, 280)
         .strokeColor('#F3F4F6')
         .lineWidth(1)
         .stroke();

      doc.fillColor('#1E293B')
         .font('Helvetica-Bold')
         .fontSize(11)
         .text('Total Amount Settled:', 320, 302, { width: 140, align: 'right' })
         .fillColor('#2563EB')
         .fontSize(13)
         .text(`$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}`, 470, 301, { width: 90, align: 'right' });


      doc.save();
      doc.translate(450, 380);
      doc.rotate(-12);

      doc.rect(-70, -25, 140, 50).lineWidth(3.5).strokeColor('#10B981').stroke();

      doc.rect(-65, -20, 130, 40).lineWidth(1.2).strokeColor('#10B981').stroke();
      
      doc.fillColor('#10B981')
         .font('Helvetica-Bold')
         .fontSize(18)
         .text('PAID', -65, -8, { width: 130, align: 'center' });
         

      doc.restore();


      doc.rect(50, 680, 512, 50).fill('#F9FAFB');
      doc.rect(50, 680, 512, 50).strokeColor('#E5E7EB').lineWidth(1).stroke();
      doc.fillColor('#9CA3AF')
         .font('Helvetica-Oblique')
         .fontSize(7.5)
         .text('COMPLIANCE NOTE: This is a verified electronic transaction receipt issued on behalf of Nexus Corporate. Cryptographic records of this payment are stored inside the VaultPay Core transaction registry. This document serves as proof of settlement. All charges are final and processed under the platform terms of service.', 60, 688, { width: 492, align: 'justify' });

      doc.end();

      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceipt };
