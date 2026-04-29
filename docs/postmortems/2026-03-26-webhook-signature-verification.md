# Postmortem — Webhook Signature Verification: Unimplementable Security Control

**Date:** 2026-03-26
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

Webhook signature verification via HMAC-SHA256 was a planned security control. During Milestone 6 implementation it was discovered that GAS `doPost` does not expose incoming HTTP request headers, making it impossible to read the `X-Moe-Signature-256` header required for verification. The control was removed entirely. Company ID filtering became the primary security boundary.

---

## Timeline

| Time            | Event                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pre-Milestone 6 | Webhook signature verification planned and partially implemented — `verifyWebhookSignature` function written and tested |
| 2026-03-26      | `doPost` wired in Milestone 6 — signature verification integrated using `e.parameter` to read headers                   |
| 2026-03-26      | Live webhook delivery confirmed returning `Forbidden` — signature never matched                                         |
| 2026-03-26      | Investigation revealed `e.parameter` contains URL query parameters only — HTTP headers are not exposed in GAS `doPost`  |
| 2026-03-26      | Confirmed via GAS documentation — no mechanism exists to access incoming request headers in a GAS web app               |
| 2026-03-26      | Decision made to remove signature verification entirely — `verifyWebhookSignature` removed from codebase                |
| 2026-03-26      | Company ID filtering confirmed as the primary security control                                                          |
| 2026-03-26      | Middleware layer (Cloudflare Worker or similar) identified as the correct post-MVP path for signature verification      |

---

## Root Cause

GAS web apps do not expose incoming HTTP request headers to `doPost`. This is a documented platform limitation. The plan assumed standard HTTP request access without verifying GAS-specific constraints upfront.

---

## Contributing Factors

- GAS platform capabilities were not audited before planning — the header access limitation was researchable but not researched
- `verifyWebhookSignature` was fully implemented and tested before the runtime limitation was discovered, representing wasted implementation effort
- MoeGo webhook secrets are visible in plaintext via the `ListWebhooks` API response — any URL-based secret approach would have offered no meaningful additional protection, ruling out the most obvious workaround

---

## Impact

The planned security control was never operational. All webhook deliveries from Milestone 6 onward rely solely on company ID filtering. Any actor with knowledge of the endpoint URL and a valid `<companyId>` company ID in their payload could trigger the flow. For the current single-location deployment this is an acceptable risk, but it is a genuine security gap.

---

## Action Items

| Action                                                                                         | Owner           | Due                |
| ---------------------------------------------------------------------------------------------- | --------------- | ------------------ |
| Document GAS header access limitation in `docs/development-plan.md`                            | scottgilmoredev | Done — Milestone 6 |
| Add middleware layer for signature verification to `docs/enhancements.md` as post-MVP priority | scottgilmoredev | Done — Milestone 6 |

---

## Lessons Learned

GAS `doPost` does not expose incoming request headers — this must be treated as a known constraint on any future GAS webhook receiver. Signature verification requires a middleware layer in front of GAS. Any security control that depends on reading request headers must be validated against the GAS platform before implementation begins.
