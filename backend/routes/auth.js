const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required'
    });
  }


  let user = db.getClientByEmail(email);
  if (!user) {
    user = db.getAdminByEmail(email);
  }

  if (!user || user.password !== password) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid email or password'
    });
  }


  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'super_secret_vaultpay_key',
    { expiresIn: '2h' }
  );

  return res.json({
    token,
    client: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    client: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router;
