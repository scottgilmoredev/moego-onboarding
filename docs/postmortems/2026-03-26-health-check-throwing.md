# Postmortem — Health Check Payloads: Unhandled Throw in parseWebhookPayload

**Date:** 2026-03-26
**Severity:** P3 — Medium
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

MoeGo health check webhook deliveries caused `parseWebhookPayload` to throw `Invalid webhook payload: missing required customer field "id"` on every delivery. Health check payloads have no customer object. The event type check occurred after customer field validation, so health checks never reached the point where they could be gracefully ignored. Fixed by discriminating event type before customer field validation.

---

## Timeline

| Time       | Event                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-26 | Webhook registered with MoeGo — health check delivery fired immediately                                                                                       |
| 2026-03-26 | Response body decoded to `Invalid webhook payload: missing required customer field "id"`                                                                      |
| 2026-03-26 | Root cause identified — `parseWebhookPayload` validated customer fields before checking event type                                                            |
| 2026-03-26 | Fix applied — event type discriminated before customer field validation; unsupported event types return a base `MoeGoEvent` without customer field validation |
| 2026-03-26 | Health check deliveries confirmed returning `OK` after fix                                                                                                    |

---

## Root Cause

`parseWebhookPayload` performed customer field validation before checking event type. Health check payloads contain no customer object, so validation threw before the event type could be identified and the payload gracefully ignored.

---

## Contributing Factors

- The health check event type was not considered when designing the validation order in `parseWebhookPayload`
- MoeGo fires a health check immediately on webhook registration — the issue surfaced on the very first delivery
- The original design assumed all incoming payloads would be customer events, which was not a valid assumption for a webhook endpoint receiving multiple event types

---

## Impact

Every health check delivery produced a thrown exception in production. While health checks returned HTTP 200 (GAS always returns 200), the error noise was consistent throughout the testing phase and obscured other issues in the delivery logs.

---

## Action Items

| Action                                                                                                                                                        | Owner           | Due     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| When registering webhooks on any platform, review all possible event types the endpoint may receive — not just the intended ones — and handle each explicitly | scottgilmoredev | Ongoing |

---

## Lessons Learned

Webhook endpoints receive all event types the platform may send, not just the ones the application intends to handle. Payload validation must account for structural differences between event types before applying field-level validation. When registering a new webhook, review the full set of possible event types the platform may deliver and handle each one explicitly.
