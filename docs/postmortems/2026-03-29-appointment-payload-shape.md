# Postmortem — APPOINTMENT_CREATED Payload Shape Mismatch

**Date:** 2026-03-29
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

The webhook validator was checking for a nested `customer` object on all incoming payloads, but `APPOINTMENT_CREATED` events nest data under `appointment`. Every webhook delivery was rejected with "missing required customer field 'id'" before the onboarding flow could run. Customer details are now fetched separately via the MoeGo Customer API after the webhook is parsed.

---

## Timeline

| Time       | Event                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-28 | Supported event type changed from `CUSTOMER_CREATED` to `APPOINTMENT_CREATED`                                                                  |
| 2026-03-28 | `REQUIRED_CUSTOMER_FIELDS` validation left in place — not updated to reflect new payload shape                                                 |
| 2026-03-29 | Webhook logs reviewed — Discovered `Error: Invalid webhook payload: missing required customer field` from `parseWebhookPayload` error handling |
| 2026-03-29 | Webhook deliveries reviewed — `APPOINTMENT_CREATED` payload confirmed to use `appointment.customerId`, not `customer.id`                       |
| 2026-03-29 | Validator updated to check `appointment.customerId`; `getCustomer()` added to fetch customer details via API                                   |
| 2026-03-29 | `doPost` refactored to extract `fetchCustomer`, `fetchOnboardingLinks`, `sendOnboardingEmail`                                                  |
| 2026-03-29 | Fix merged via PR — onboarding flow operational                                                                                                |

---

## Root Cause

When the supported event type was changed from `CUSTOMER_CREATED` to `APPOINTMENT_CREATED`, the webhook validator was not updated to reflect the different payload shape. `CUSTOMER_CREATED` events nest customer data directly under `customer`. `APPOINTMENT_CREATED` events nest appointment data under `appointment`, with only a `customerId` reference — no customer object is present in the payload.

---

## Contributing Factors

- The event type change and the validator change were not treated as a single atomic update
- No webhook delivery log review was performed after the event type change to confirm end-to-end flow

---

## Impact

All `APPOINTMENT_CREATED` webhook deliveries were failed. No onboarding emails were sent from the point the event type was changed until the fix was deployed. The business owner would have needed to manually complete onboarding for any new clients during this window.

---

## Action Items

| Action                                                                                                  | Owner           | Due        |
| ------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| Add decision log entry documenting `APPOINTMENT_CREATED` vs `CUSTOMER_CREATED` payload shape difference | scottgilmoredev | 2026-03-29 |
| Verify end-to-end flow via webhook delivery log after any future event type or payload change           | scottgilmoredev | Ongoing    |

---

## Lessons Learned

Event type changes must be treated as full payload contract changes — the validator, types, and any downstream field references must all be updated atomically. Webhook delivery logs should be reviewed after any event type or payload change to confirm the end-to-end flow is operational before assuming the change is complete.
