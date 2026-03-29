# Postmortem — Email Deliverability: Spam and Hard Rejection

**Date:** 2026-03-27
**Severity:** P1 — Critical
**Status:** Complete
**Author:** scottgilmoredev

---

## Summary

Emails sent by the deployed script were delivered to spam across all tested email clients. Zoho MX additionally rejected delivery outright with `554 5.7.7`. Root cause was that the script was deployed under a Google account associated with a custom domain (`scottgilmore.dev`), which lacked DKIM signing. `MailApp` sends from the deploying account with no override capability — redeployment under a `@gmail.com` account was required to achieve inbox delivery.

---

## Timeline

| Time       | Event                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-27 | First successful end-to-end flow execution — email sent but not received in inbox                                                                             |
| 2026-03-27 | Email located in spam folder of Gmail test account                                                                                                            |
| 2026-03-27 | Zoho MX rejection discovered — `554 5.7.7 Email policy violation detected`                                                                                    |
| 2026-03-27 | SPF record for `scottgilmore.dev` updated in Vercel DNS to include `include:_spf.google.com`                                                                  |
| 2026-03-27 | SPF fix confirmed propagated — Zoho hard rejection resolved                                                                                                   |
| 2026-03-27 | Emails still landing in spam across all tested clients despite SPF fix                                                                                        |
| 2026-03-27 | Root cause identified — DKIM not available for custom domain on personal Gmail; deploying account identity is the send-from address with no override possible |
| 2026-03-27 | `@gmail.com` account added as user on GAS project                                                                                                             |
| 2026-03-27 | Script redeployed with `@gmail.com` account as `Execute as` — required signing into that account in the browser to appear as an option                        |
| 2026-03-27 | Emails confirmed landing in inbox across all tested clients including business owner                                                                          |

---

## Root Cause

`MailApp` always sends from the deploying account and does not support `From` overrides or Gmail send-as aliases. The deploying account was associated with a custom domain (`scottgilmore.dev`). DKIM signing for custom domains requires Google Workspace, which is unavailable on personal Gmail. Without DKIM, outbound email failed DMARC checks and was treated as spam or rejected outright.

---

## Contributing Factors

- The relationship between deploying account identity, `MailApp` send-from behavior, and DKIM/DMARC authentication was not evaluated before Milestone 5
- SPF was initially missing `include:_spf.google.com`, causing Zoho to hard-reject before the deeper DKIM issue was identified — this masked the root cause and added investigation time
- The `Execute as` field in GAS only presents the currently signed-in user as an option — the Gmail account had to be the active browser session at deployment time, which was not obvious

---

## Impact

Every email sent by the script landed in spam for the duration of the affected deployments. The business owner would not have received actionable onboarding notifications. Zoho users would have received no delivery at all.

---

## Action Items

| Action                                                                                                       | Owner           | Due           |
| ------------------------------------------------------------------------------------------------------------ | --------------- | ------------- |
| Document deploying account identity requirement and its email authentication implications in deployment docs | scottgilmoredev | Next doc pass |
| Document `Execute as` field behavior — signed-in user requirement — in deployment docs                       | scottgilmoredev | Next doc pass |

---

## Lessons Learned

On any GAS project that sends email, the deploying account must be evaluated for email authentication (SPF, DKIM, DMARC) before deployment. `MailApp` provides no send-from flexibility — the deploying account identity is the sender identity, period. For inbox delivery, the deploying account should be a `@gmail.com` account unless Google Workspace is available for the custom domain.
