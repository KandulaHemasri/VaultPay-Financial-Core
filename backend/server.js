const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());

const webhooksRouter = require('./routes/webhooks');
app.use('/api/webhooks', webhooksRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRouter = require('./routes/auth');
const invoicesRouter = require('./routes/invoices');

app.use('/api/auth', authRouter);
app.use('/api/invoices', invoicesRouter);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`   VAULTPAY FINANCIAL CORE SECURE LEDGER ENGINE       `);
  console.log(`   Server Active: http://localhost:${PORT}             `);
  console.log(`   Listening to events, webhooks, and secure requests `);
});
