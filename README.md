# ⚡ VaultPay Financial Core

> **Zero-Trust Dashboard, IDOR Protection Audit, & Stripe Webhooks Integration Showcase.**

VaultPay Financial Core is a secure digital transactions ledger and dashboard built to demonstrate zero-trust network principles, automated IDOR (Insecure Direct Object Reference) prevention, and secure Stripe webhook ingestion. 

This repository contains both the **Express.js API Backend** and a **Vanilla JS/CSS glassmorphic Frontend Portal**.

---
## Live link - https://vault-pay-financial-core-ruby.vercel.app/
## 🔒 Demonstration Credentials

To run audits, simulate attacks, or test invoicing features, you can log in using any of the following pre-configured user credentials. These roles grant different access privileges within the zero-trust system:

| Role | Client Name / Identity | Email (Security Identity) | Password (Authorization Key) | Client ID |
| **Client A** | Apex Corp | `apex@corp.com` | `apex123_secure` | `123` |
| **Client B** | Beta Solutions | `beta@solutions.com` | `beta456_secure` | `456` |
| **Administrator** | System Admin | `admin@vaultpay.io` | `admin123_secure` | `admin_01` |

---

## 🚀 Key Features Demonstrated

1. **Cryptographically Secure Sessions**: Uses JSON Web Tokens (JWT) stored securely and passed via `Bearer` headers to authorize client sessions.
2. **Zero-Trust IDOR Attack Simulator**: 
   - Interactive testing interface allowing clients to attempt to fetch records belonging to other tenants (e.g. Client A attempting to fetch Client B's invoices).
   - Real-time logging console illustrating how the server middleware checks ownership mappings and successfully blocks unauthorized requests.
3. **Stripe Webhook ingestion**:
   - Live endpoint (`/api/webhooks/stripe`) that authenticates and validates signature metadata.
   - Front-end simulator to trigger mock server-to-server webhook payment success requests.
   - Dynamic UI log streaming to inspect incoming payloads.
4. **Interactive Invoicing Operations**:
   - Administrator dashboard capable of creating new invoices for specific Client IDs.
   - Dynamic, securely-generated invoice PDF downloads (powered by `pdfkit`) with cryptographically verified JWT access audits.

---

## 🛠️ Installation & Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v16+ recommended).

### 2. Backend Environment Variables
Create a file named `.env` in the `backend/` directory and populate it with JWT and STRIPE KEYS

### 3. Run the Server
Navigate to the `backend/` folder, install the required packages, and start the application:

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start the server
npm start
```

Once running, the backend will display:
```text
   VAULTPAY FINANCIAL CORE SECURE LEDGER ENGINE       
   Server Active: http://localhost:3000             
   Listening to events, webhooks, and secure requests 
```


The backend serves the frontend statically, so everything runs under a single port.

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
* `POST /login` - Establish identity. Requires `{ email, password }`. Returns JWT token and user profile.
* `GET /me` - Validate active token. Requires `Authorization: Bearer <token>`.

### 🧾 Invoices (`/api/invoices`)
* `GET /` - Retrieve ledger statements. 
  - *Clients* only receive their own invoices.
  - *Admins* receive all system invoices.
  - Requires `Authorization: Bearer <token>`.
* `POST /` - Add a new invoice. Requires `{ clientId, amount, description, stripeInvoiceId }`.
  - Restricted to `admin` roles only.
* `GET /:id` - Retrieve specific invoice payload. Requires ownership match or admin role.
* `GET /:id/pdf` - Securely compiles and downloads a cryptographic PDF statement.

### 🔌 Webhooks (`/api/webhooks`)
* `POST /stripe` - Ingestion engine for Stripe signature checks. Automatically maps unpaid invoices to `paid` status upon verification.
