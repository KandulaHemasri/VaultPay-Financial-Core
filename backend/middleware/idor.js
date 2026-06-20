const db = require('../db');

module.exports = function invoiceIdorMiddleware(req, res, next) {
  const invoiceId = req.params.id;
  
  if (!invoiceId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invoice ID parameter is missing'
    });
  }

  const invoice = db.getInvoiceById(invoiceId);

  if (!invoice) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Invoice matching ID '${invoiceId}' was not found`
    });
  }

  if (req.user.role !== 'admin' && invoice.clientId !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Access Denied: Resource does not belong to client '${req.user.id}'`
    });
  }

  req.invoice = invoice;
  next();
};
