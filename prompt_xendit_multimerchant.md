# Implement Payment Gateway Module (Multi-Merchant Architecture)

You are a Senior Software Engineer.

Project Stack:

* Next.js 15 (App Router)
* TypeScript
* Supabase PostgreSQL
* Supabase Auth
* Tailwind CSS
* Multi Merchant POS (UrangPOS)

## Objective

Create a scalable Payment Gateway module that supports multiple merchants.

Each merchant owns their own payment gateway account (starting with Xendit).

UrangPOS **must never store global payment gateway credentials in `.env`** except for application-level configuration.

Each merchant will connect their own Xendit account by providing:

* Secret API Key
* Webhook Verification Token

These credentials must be stored securely and used only for that merchant's transactions.

---

# Database Design

Create a new table:

`pos_payment_gateways`

Columns:

* id (uuid, primary key)
* merchant_id (uuid, FK -> pos_stores.id)
* provider (text) // xendit, midtrans, duitku
* secret_key (text) // encrypted before saving
* webhook_token (text) // encrypted before saving
* sandbox_mode (boolean)
* is_active (boolean)
* created_at
* updated_at

Constraints:

* One active payment gateway per merchant/provider.
* Index merchant_id.

Do NOT store API keys inside `.env`.

---

# Encryption

Create reusable utility functions.

```
encryptSecret(text)

decryptSecret(text)
```

Requirements:

* AES-256 encryption
* Encryption key comes from

ENCRYPTION_KEY

inside `.env.local`

Only decrypt when making API requests.

Never expose decrypted values to frontend.

---

# Merchant Settings Page

Create

Settings
→ Payment Gateway

Features:

Provider dropdown

* Xendit
* Midtrans (future)
* Duitku (future)

Fields

Secret API Key

Webhook Verification Token

Sandbox Mode

Enable / Disable

Buttons

Save

Test Connection

Status Badge

Connected

Disconnected

Invalid API Key

---

# Backend

When Save is clicked

Validate input.

Encrypt Secret API Key.

Encrypt Webhook Token.

Store in

pos_payment_gateways

---

# Test Connection

When user clicks

Test Connection

Backend should

Decrypt Secret Key.

Call provider API.

Return

Connected

or

Invalid API Key

without exposing any sensitive data.

---

# Checkout Flow

When customer places an order

Backend must

Find merchant_id.

Load payment gateway configuration.

Decrypt Secret API Key.

Instantiate provider SDK using that merchant's credentials.

Generate payment request.

Return payment information.

Never use a global Secret API Key.

---

# Architecture

Customer

↓

Merchant

↓

Backend

↓

Load merchant payment gateway

↓

Decrypt credentials

↓

Call Xendit

↓

Generate QRIS

↓

Return QR

---

# Security Requirements

* Never expose Secret API Key to frontend.
* Never log Secret API Key.
* Encrypt before database storage.
* Decrypt only inside server actions/API routes.
* Validate merchant ownership before reading payment settings.
* Follow Next.js Server Component and Server Action best practices.

---

# Future Extensibility

The module must support additional providers without changing business logic.

Implement a provider pattern such as:

```
PaymentProvider

XenditProvider

MidtransProvider

DuitkuProvider
```

The checkout flow should depend on an interface instead of provider-specific logic.

---

# Deliverables

Generate:

* SQL migration
* TypeScript interfaces
* Supabase types
* Encryption utilities
* Server Actions / API Routes
* Payment Gateway Settings UI
* Validation
* Repository pattern
* Provider abstraction
* Complete production-ready folder structure

Code should be clean, modular, scalable, and follow SOLID principles.
