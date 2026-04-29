# Postmortem — GmailApp: Operation Not Allowed in ANYONE_ANONYMOUS Context

**Date:** 2026-03-26
**Severity:** P2 — High
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

`GmailApp.sendEmail` threw "Gmail operation not allowed" on every webhook delivery after the full flow was first wired. The script was deployed as `ANYONE_ANONYMOUS` — a GAS web app access level that restricts certain sensitive operations including `GmailApp`. Replaced with `MailApp.sendEmail` and updated the OAuth scope from `gmail.send` to `script.send_mail`.

---

## Timeline

| Time        | Event                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Milestone 5 | Email delivery implemented using `GmailApp.sendEmail` — unit tests passing with mocked globals                                                   |
| 2026-03-26  | Full flow wired in Milestone 6 — deployed to GAS as `ANYONE_ANONYMOUS` web app                                                                   |
| 2026-03-26  | Live webhook delivery confirmed reaching email step — response body decoded to `Exception: Gmail operation not allowed`                          |
| 2026-03-26  | GAS documentation confirmed — `GmailApp` is not permitted in `ANYONE_ANONYMOUS` context                                                          |
| 2026-03-26  | `GmailApp` replaced with `MailApp` throughout `src/email/email.ts`                                                                               |
| 2026-03-26  | OAuth scope updated from `https://www.googleapis.com/auth/gmail.send` to `https://www.googleapis.com/auth/script.send_mail` in `appsscript.json` |
| 2026-03-26  | All affected test stubs updated from `GmailApp` to `MailApp`                                                                                     |
| 2026-03-26  | Redeployed — `GmailApp` error resolved                                                                                                           |

---

## Root Cause

`GmailApp` is not available in GAS web apps deployed with `ANYONE_ANONYMOUS` access. This is a documented GAS platform constraint. The plan specified `GmailApp` without verifying its compatibility with the intended deployment access level.

---

## Contributing Factors

- GAS OAuth behavior by access level was not evaluated before Milestone 5 implementation
- Unit tests mocked `GmailApp` successfully — the constraint only surfaces at runtime in a deployed web app context, providing no test-time signal
- The distinction between `GmailApp` and `MailApp` and their respective access level constraints was not known upfront

---

## Impact

Email delivery failed on every webhook delivery for the duration of the affected deployments. The full flow reached the email step but threw before sending, resulting in a 200 response with an error in the response body and no email delivered to the business owner.

---

## Action Items

| Action                                                                           | Owner           | Due           |
| -------------------------------------------------------------------------------- | --------------- | ------------- |
| Document `GmailApp` vs `MailApp` constraints by GAS access level in project docs | scottgilmoredev | Next doc pass |

---

## Lessons Learned

On any GAS project that sends email, verify which email service (`GmailApp` vs `MailApp`) is compatible with the intended web app access level before writing any email code. `GmailApp` is not available in `ANYONE_ANONYMOUS` context. `MailApp` is the correct service for anonymous web app deployments.
