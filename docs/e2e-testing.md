# E2E Testing Guide — moego-onboarding

## Overview

This guide covers end-to-end validation of the deployed GAS web app. It assumes the app is deployed and Script Properties are fully configured. See [sheet-setup.md](sheet-setup.md) for the full environment variable reference and [clasp-setup.md](clasp-setup.md) for deployment instructions.

---

## Prerequisites

- GAS web app deployed and `LANDING_PAGE_URL` set in Script Properties
- All Script Properties configured (see [sheet-setup.md](sheet-setup.md))
- Google Sheet and Drive folder created and accessible
- A test customer in MoeGo with no prior finished appointments (to exercise the new client path)

---

## Triggering a Test Webhook

MoeGo does not provide a webhook test tool. Trigger the flow manually with curl:

```bash
curl -L "<YOUR_LANDING_PAGE_URL>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_001",
    "type": "APPOINTMENT_CREATED",
    "timestamp": "2026-01-01T12:00:00Z",
    "companyId": "<YOUR_MOEGO_COMPANY_ID>",
    "moegoWebhookSecret": "<YOUR_MOEGO_WEBHOOK_SECRET>",
    "appointment": {
      "id": "apt_test_001",
      "businessId": "<YOUR_MOEGO_BUSINESS_ID>",
      "customerId": "<TEST_CUSTOMER_ID>"
    }
  }'
```

> **Note:** Use `-L` to follow the GAS redirect, but omit `-X POST`. GAS redirects POST requests — `-L` with `-d` follows the redirect and preserves POST behavior. Adding `-X POST` explicitly causes curl to reissue the redirect as POST rather than the expected GET on the final URL, resulting in a redirect loop.

> **Note:** Do not use `-L` with curl. The `-L` flag follows redirects and converts POST to GET on redirect, which causes `e.postData` to be undefined in `doPost`.

A successful response is:

```
OK
```

---

## Verification Checklist

After triggering the webhook, verify each of the following:

### Owner Email

- [ ] Business owner receives a success email with subject `New Client Onboarding — {firstName} {lastInitial}.`
- [ ] Email body contains a shortened `abc.short.gy` link

### Google Sheet

- [ ] A new row is appended with the client's first name, last name, phone, onboarding link, customer ID, and sent-at timestamp

### Landing Page

- [ ] Visiting the shortened link redirects to the GAS landing page
- [ ] Page renders without error — no "This link is no longer valid" message
- [ ] Greeting reads `We're so excited to have you here, {firstName}!`
- [ ] All three onboarding steps (Service Agreement, SMS Agreement, Card on File) display buttons linking to the correct MoeGo URLs
- [ ] Vaccination record upload step is present and active

### File Upload

- [ ] Selecting and uploading a file completes without error
- [ ] Upload button transitions: `Upload` → `Uploading...` → `Uploaded`
- [ ] Uploaded file appears in the configured Google Drive folder
- [ ] Filename is prefixed: `{firstName}_{lastName}_{originalFilename}`
- [ ] Refreshing the page after upload renders the upload step as already completed (`Uploaded` state)

---

## Returning Client — Skipped Flow

To verify the returning client check:

1. Use a test customer who has at least one finished appointment in MoeGo
2. Trigger the webhook with that customer's ID
3. Confirm no email is sent, no sheet row is written, and the response is `OK`

---

## Re-trigger Verification

To verify the re-trigger flow:

1. Use the test customer from the initial flow (they should have an existing sheet row)
2. Follow the steps in [retrigger-guide.md](retrigger-guide.md) to invoke `retriggerOnboarding` from the GAS editor with the customer's ID
3. Confirm the owner receives a success email with a new shortened link
4. Confirm the Onboarding Link and Sent At columns in the sheet row are updated with the new values

To verify the skipped-client path (no existing row):

1. Use a test customer whose webhook was previously skipped (returning client) and who has no sheet row
2. Invoke `retriggerOnboarding` with their Customer ID
3. Confirm a new row is inserted in alphabetical order and the owner receives a success email

---

## Failure Spot-Checks

### Full failure email

Temporarily set `MOEGO_API_KEY` to an invalid value in Script Properties, trigger the webhook, then restore the correct value. The owner should receive a full failure email with no sheet row written.

### Short.io failure email

Temporarily set `SHORTIO_API_KEY` to an invalid value, trigger the webhook, then restore. The owner should receive a failure email containing the full unshortened token URL.

### Invalid token

Visit the landing page URL with a malformed or missing token (e.g. `?token=invalid`). The error page should render with the business phone number for support contact.

---

## GAS Logs

Execution logs are available in the GAS editor under **Executions**. Each `doPost` call logs progress and any errors at key steps — useful for diagnosing failures without a local debugger.

Cloud Logging is also available in Google Cloud Console under the project associated with the GAS script. Filter by `script.googleapis.com/console_logs` to see structured log output.
