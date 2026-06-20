const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Access Denied',
      message: 'Authorization header is missing'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Access Denied',
      message: 'Token format must be Bearer <token>'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_vaultpay_key');
    
    let user;
    if (decoded.role === 'admin') {
      user = db.getAdminById(decoded.id);
    } else {
      user = db.getClientById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({
        error: 'Access Denied',
        message: 'User associated with token no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Access Denied',
      message: 'Invalid or expired authentication token'
    });
  }
};
