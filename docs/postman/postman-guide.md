# Postman Guide — moego-onboarding

This collection covers all external API calls made by the moego-onboarding
script. Use it to look up customers, generate onboarding links manually,
diagnose issues, and shorten URLs without logging into any external dashboard.

---

## Setup

### Step 1 — Import the collection and environment

1. Open Postman
2. Click **Import** in the sidebar
3. Select or drag both files at once:
   - `moego-onboarding.collection.json`
   - `moego-onboarding.environment.json`
4. Click **Import** to confirm
5. An **Import Complete** message appears in the footer — click **Go to Collection** to view

### Step 2 — Activate the environment

In the top-right environment dropdown, select **moego-onboarding**.

### Step 3 — Fill in the environment variables

Click the environment name to open the variable editor. Fill in all values
marked with `<...>` placeholders:

| Variable                  | Where to find it                                       |
| ------------------------- | ------------------------------------------------------ |
| `moegoApiKey`             | MoeGo dashboard — Settings — API                       |
| `moegoCompanyId`          | MoeGo dashboard — Settings — Company info              |
| `moegoBusinessId`         | MoeGo dashboard — Settings — Locations                 |
| `moegoServiceAgreementId` | MoeGo dashboard — Agreements — Service Agreement       |
| `moegoSmsAgreementId`     | MoeGo dashboard — Agreements — SMS Agreement           |
| `shortIoApiKey`           | Short.io dashboard — Integrations — API key            |
| `shortIoDomain`           | Short.io dashboard — Domains                           |
| `landingPageUrl`          | GAS editor — Deploy — Manage deployments — Web app URL |

`moegoBaseUrl` is pre-filled and should not need to change.

`customerId`, `customerPhone`, and `fullUrl` are left blank — fill these in
per use as described in the scenarios below.

---

## Finding a Customer ID

The Customer ID is the MoeGo API identifier for a client (e.g. `cus_a1b2c3d4`).
It is different from the numeric ID shown in the MoeGo UI URL — that ID is
internal to the MoeGo UI and is not accepted by the API.

**Primary source:** The Google Sheet, column E (Customer ID). Find the client
row by name.

**If the sheet row is missing**, use **MoeGo — List Customers by Phone**:

1. Set `customerPhone` in the environment to the client's 10-digit phone number
   (no country code — e.g. `4049850300`)
2. Run **MoeGo — List Customers by Phone**
3. Find the matching customer in the `customers` array
4. Copy the `id` field value into `customerId` in the environment
5. Proceed with retrigger or any other request

---

## Usage by scenario

### Look up a customer by phone

Use when the Customer ID is unknown.

1. Set `customerPhone` to the client's 10-digit phone number (no country code)
2. Run **MoeGo — List Customers by Phone**
3. Copy `id` from the matching result into `customerId`

---

### Confirm a Customer ID is valid

1. Set `customerId` in the environment
2. Run **MoeGo — Get Customer**
3. Response confirms the customer exists and shows their full details

---

### Generate onboarding links manually

If you need to send a client their agreement or payment links without running
the full retrigger flow:

1. Set `customerId` in the environment
2. Run any combination of:
   - **MoeGo — Get Service Agreement Sign Link** — returns `signUrl`
   - **MoeGo — Get SMS Agreement Sign Link** — returns `signUrl`
   - **MoeGo — Get Card-on-File Link** — returns `link`
3. Copy the URLs from the responses and send them to the client directly

Each call generates a fresh URL. Links are not reused across calls.

---

### Shorten a URL manually

Use when you have a full landing page URL and need a shortened link — for
example after receiving a Short.io failure email, or when the retrigger flow
is unavailable.

1. Set `fullUrl` in the environment to the full landing page URL
   (e.g. `https://script.google.com/macros/s/.../exec?token=...`)
2. Run **Short.io — Shorten URL**
3. Copy `shortURL` from the response and send it to the client

---

### Diagnose a skipped client

The system skips onboarding for customers who already have a completed
appointment. If a new client was incorrectly skipped:

1. Set `customerId` in the environment
2. Run **MoeGo — Check Finished Appointments**
3. If `appointments` is non-empty, the system correctly identified them as a
   returning client based on their appointment history in MoeGo

---

## Keeping the collection in sync

When the codebase changes, update the collection to match:

| What changed                                            | What to update in the collection                            |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `src/moego/moego.ts` — new or modified API call         | Add or update the corresponding request in the MoeGo folder |
| `src/shortener/shortener.ts` — shortener URL or payload | Update **Short.io — Shorten URL**                           |
| `src/utils/config.ts` — new config property             | Add the corresponding variable to the environment file      |
| `MOEGO_BASE_URL` constant changed                       | Update `moegoBaseUrl` default value in the environment file |
| Auth header format changed (`buildAuthHeader`)          | Update the `Authorization` header in all MoeGo requests     |

After updating, re-export a populated copy and share the updated file with
the owner.
