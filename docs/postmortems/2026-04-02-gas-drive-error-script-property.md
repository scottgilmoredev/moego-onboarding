# Postmortem — GAS Drive Error Page from Misconfigured Script Property

**Date:** 2026-04-02
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

Triggering a webhook against the deployed GAS web app returned an HTML "unable to open file" Drive error page instead of the expected `OK` response. The root cause was two compounding issues: `getConfig()` throwing on a misnamed Script Property (`BUSINESS_OWNER_EMAIL` instead of `BUSINESS_OWNER_EMAILS`), and `doPost` having no top-level try/catch — allowing any unhandled throw to propagate to the GAS runtime, which returned a Drive error page rather than a meaningful error response.

---

## Timeline

| Time       | Event                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-04-02 | First E2E test against deployed GAS web app — curl returns HTML Drive error page                            |
| 2026-04-02 | Suspected stale deployment, auth issues, wrong URL — all ruled out                                          |
| 2026-04-02 | GCP logs reviewed — `getConfig()` throwing on missing Script Property identified                            |
| 2026-04-02 | Root cause confirmed: Script Property key was `BUSINESS_OWNER_EMAIL`, code expected `BUSINESS_OWNER_EMAILS` |
| 2026-04-02 | Script Property renamed to `BUSINESS_OWNER_EMAILS`                                                          |
| 2026-04-02 | Top-level try/catch added to `doPost` — unhandled errors now return `OK` instead of Drive error page        |
| 2026-04-02 | E2E test confirmed working                                                                                  |

---

## Root Cause

`getConfig()` validates all required Script Properties on load and throws if any are missing. The Script Property key `BUSINESS_OWNER_EMAILS` (plural) was stored as `BUSINESS_OWNER_EMAIL` (singular) in the GAS project settings, causing every `doPost` invocation to throw before any application logic executed. `doPost` had no top-level try/catch — the unhandled throw propagated to the GAS runtime, which surfaced it as an HTML Drive error page rather than returning a meaningful HTTP response.

---

## Contributing Factors

- Script Property key naming inconsistency between `.env.example` and the deployed Script Properties was not caught before E2E testing
- `doPost` had no top-level error boundary — any unhandled throw produced a Drive error page with no diagnostic value
- The Drive error page gave no indication of the actual failure — the error appeared infrastructure-related rather than application-level, leading to wasted diagnosis time

---

## Impact

All webhook deliveries during this window returned a Drive error page. No onboarding emails were sent and no sheet rows were written. The error was caught during initial E2E testing and did not affect real client traffic.

---

## Action Items

| Action                                                                | Owner           | Due               |
| --------------------------------------------------------------------- | --------------- | ----------------- |
| Add top-level try/catch to `doPost` — unhandled errors return `OK`    | scottgilmoredev | Done — 2026-04-02 |
| Rename Script Property to `BUSINESS_OWNER_EMAILS` in deployed project | scottgilmoredev | Done — 2026-04-02 |
| Update `.env.example` to use `BUSINESS_OWNER_EMAILS`                  | scottgilmoredev | Done — 2026-04-02 |

---

## Lessons Learned

Script Property key names must exactly match what the code expects — a mismatch causes a silent throw at config load time with no helpful runtime error. `doPost` must have a top-level try/catch that returns `OK` on any unhandled error; the GAS runtime's fallback error surface (Drive error page) provides no diagnostic value and can be mistaken for an infrastructure or deployment issue. E2E testing should include a GCP log review on the first successful trigger to confirm the full code path executed.
