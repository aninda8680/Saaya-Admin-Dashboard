# Odoo CRM Integration — Requirements & Exploration Guide

> **Context:** The company wants to use **Odoo** as its Customer Relationship Management (CRM) backend. User/customer profile data that currently lives in our Firebase `customers` collection should also be stored and managed in Odoo. The admin dashboard should be able to **read** that data from Odoo and allow **editing** it — without the admin ever needing to log into Odoo directly.

---

## 🎯 What They Actually Want (Plain English)

| # | Requirement | Details |
|---|-------------|---------|
| 1 | **Odoo as the source of truth for customer profiles** | Name, email, phone number, and other contact-level fields should live in Odoo's CRM module (as `res.partner` or CRM contacts), not only in Firebase. |
| 2 | **Fetch customer data from Odoo into our dashboard** | When an admin opens a customer profile page, the data (e.g. email, phone) should be fetched live from Odoo via its External API. |
| 3 | **Edit customer data from our dashboard → saved back to Odoo** | The admin should be able to update user-level fields (name, email, phone, etc.) in our app UI, and those changes must be written back to Odoo via the API. |
| 4 | **Scope: user-level info only** | They explicitly said *"just the user level info"* — do **not** touch orders, invoices, CRM pipelines, or anything beyond basic contact/profile fields. |
| 5 | **Explore permissions & API keys** | Understand how to create an API key in Odoo, what access rights it needs, and how to securely provide it to the dashboard app. |

---

## 🏗️ Odoo Concepts You Need to Understand

### The Relevant Odoo Model: `res.partner`
In Odoo, every contact (customer, vendor, person) is a **`res.partner`** record. The fields that map to our dashboard are:

| Odoo Field | Type | Maps To Our App |
|------------|------|-----------------|
| `name` | `Char` | Customer name |
| `email` | `Char` | Customer email |
| `phone` | `Char` | Customer phone |
| `mobile` | `Char` | Mobile number (if needed) |
| `active` | `Boolean` | Active/inactive status |
| `is_company` | `Boolean` | Whether it's a company or individual |
| `customer_rank` | `Integer` | >0 means they are a customer |

> **Note:** Our current Firebase `customers` schema stores `name`, `email`, `status`, `createdAt`, and `devices`. The fields `name` and `email` are what will be synced with Odoo. `phone` may need to be added to our Firebase schema as well.

---

## 🔌 How the Odoo External API Works (JSON-2 / JSON-RPC)

The Odoo External API uses **JSON-RPC 2.0** over HTTP. The base URL pattern is:

```
POST https://<your-odoo-instance>/web/dataset/call_kw
```

Or using the newer JSON-2 API:
```
POST https://<your-odoo-instance>/api/<model>
```

### Key Operations

#### 1. Authentication (Get Session / Use API Key)
Odoo supports **API Keys** for authentication (recommended over username/password for apps).

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

#### 2. Read Customer Records (Search + Read)
```json
POST /web/dataset/call_kw
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "res.partner",
    "method": "search_read",
    "args": [[["customer_rank", ">", 0]]],
    "kwargs": {
      "fields": ["id", "name", "email", "phone", "mobile", "active"],
      "limit": 100
    }
  }
}
```

#### 3. Update a Customer Record
```json
POST /web/dataset/call_kw
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "res.partner",
    "method": "write",
    "args": [[<partner_id>], { "email": "new@email.com", "phone": "+91XXXXXXXXXX" }],
    "kwargs": {}
  }
}
```

#### 4. Create a New Customer (for dummy data testing)
```json
POST /web/dataset/call_kw
{
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "res.partner",
    "method": "create",
    "args": [{ "name": "Test User", "email": "test@saaya.com", "customer_rank": 1 }],
    "kwargs": {}
  }
}
```

---

## 🔑 API Key Setup (What You Need to Ask For)

Since **Amar doesn't have Odoo access**, here's exactly what needs to happen:

### Step 1 — Someone with Odoo Admin Access Must Do This:
1. Log in to Odoo as an administrator.
2. Go to **Settings → Technical → API Keys** (or via user profile → Preferences → API Keys).
3. Click **"New API Key"** and give it a descriptive name (e.g., `saaya-dashboard-key`).
4. Set **appropriate permissions** (see below).
5. Copy the generated key — **it's shown only once**.
6. Share the key securely with the dev team.

### Step 2 — What Permissions the API Key Needs:
The Odoo user account tied to the API key needs these minimum permissions:
- **Contacts** (res.partner): `Read` + `Write` access
- **CRM** (if using CRM leads): `Read` access only (not required for Phase 1)
- **Sales**: Not needed for Phase 1

> ⚠️ **Do NOT give full Admin access** to the API key. Create a dedicated Odoo user with only `Contacts/Read+Write` permissions and generate the API key from that user account.

### Step 3 — Storing the API Key in Our App:
The key must be stored as an **environment variable**, never hardcoded.

```env
# .env.local (never commit this!)
ODOO_BASE_URL=https://your-company.odoo.com
ODOO_API_KEY=your_api_key_here
ODOO_DB_NAME=your_database_name
```

In Next.js, to use this server-side only (safe):
```typescript
// lib/odoo.ts - server-side only
const ODOO_BASE_URL = process.env.ODOO_BASE_URL;
const ODOO_API_KEY = process.env.ODOO_API_KEY;
```

---

## 🧪 Phase 1 — Exploration Tasks (What to Do First)

These are the things JeetB is asking to explore before full implementation:

### Task 1: Create Dummy Users in Odoo
- [ ] Ask someone with Odoo access to create 3–5 dummy `res.partner` records (customers).
- [ ] These should have: `name`, `email`, `phone`, `customer_rank > 0`.

### Task 2: Get the API Key
- [ ] Ask the person with Odoo admin access to generate an API key with Contacts read/write.
- [ ] Confirm the Odoo instance URL and database name.

### Task 3: Build a Test Script
- [ ] Create a simple `test-odoo.ts` (or `.js`) script to:
  - Authenticate using the API key.
  - Fetch all contacts with `customer_rank > 0`.
  - Print their names and emails.

### Task 4: Integrate into the Dashboard
- [ ] Create a new API route: `app/api/odoo/customers/route.ts` (server-side, keeps key safe).
- [ ] On the customer detail page, fetch the Odoo partner data alongside the Firebase data.
- [ ] Display Odoo-sourced fields (email, phone) in the UI.
- [ ] Add an "Edit" button that calls a `PUT /api/odoo/customers/[id]` route to update the record.

### Task 5: Explore Permissions
- [ ] Test what happens when the API key user doesn't have write access (expected: 403 error).
- [ ] Document what minimum permission set is required.
- [ ] Explore if Odoo supports **field-level** permissions (e.g., admin can edit phone but not email).

---

## 🗺️ Proposed Architecture

```
Admin Dashboard (Next.js)
        │
        │  (Server-side API routes — API key stays safe)
        ▼
┌─────────────────────────┐
│  /api/odoo/customers    │  ← Proxy layer (hides API key from browser)
│  GET  → fetch list      │
│  PUT  → update record   │
└─────────────────────────┘
        │
        ▼
   Odoo Instance (res.partner)
        │
        ▼
   Firebase (devices, status, createdAt — stays as-is)
```

> **Key Decision:** Firebase continues to store device linkage, account status, and timestamps. Odoo stores the contact profile (name, email, phone). The dashboard merges both data sources on the customer detail page.

---

## ❓ Open Questions to Resolve

| Question | Who Needs to Answer |
|----------|---------------------|
| What is the Odoo instance URL? | Team with Odoo access |
| What is the database name (`db` param)? | Team with Odoo access |
| Should the Odoo `res.partner` ID be stored in Firebase alongside the customer doc? | Architecture decision |
| Is there an existing Odoo user/contact for each Firebase customer, or do they need to be created? | Business clarification |
| Who has Odoo admin access to generate the API key? | Amar / JeetB |
| Should edits in Odoo also sync back to Firebase (bi-directional), or is the dashboard the single edit point? | Business clarification |

---

## 📚 References

- [Odoo 19.0 External API Docs](https://www.odoo.com/documentation/19.0/developer/reference/external_api.html)
- [Odoo `res.partner` Model](https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html)
- [Our Firebase Customer Schema](./Firebase_Customer_Schema.md)
- [Our Firebase Device Schema](./Firebase_Device_Schema.md)
