# After Action Review — moego-onboarding

**Date:** 2026-03-28
**Scope:** Full project — Milestones 0 through 6
**Participants:** Solo

---

## What Was Planned

The project aimed to automate client onboarding for a MoeGo-based pet service business. When a new client is created in MoeGo, the system would receive a `CUSTOMER_CREATED` webhook, retrieve per-client agreement signing links and a card-on-file link from the MoeGo API, construct a pre-filled Google Form URL, shorten it via Short.io, and deliver it to the business owner via email.

The planned technical approach: TypeScript + Node.js (ESM/NodeNext), Google Apps Script as the runtime via Clasp 3.x, esbuild for compilation, Vitest for testing under strict TDD, ESLint Airbnb, GitHub Actions CI. All six milestones were scoped upfront with defined deliverables: foundations, webhook receiver, MoeGo API client, form URL builder, URL shortener, email delivery, and final integration.

The plan assumed a MoeGo sandbox environment would be available for end-to-end testing, that `GmailApp` would be viable for email delivery in an Apps Script web app, that standard web crypto APIs (`btoa`) would be available in the GAS V8 runtime, and that incoming webhook request headers would be accessible in `doPost` for signature verification.

---

## What Actually Happened

All six milestones shipped. The core flow is operational in production: MoeGo fires a webhook on client creation, the GAS web app receives it, retrieves the onboarding links, constructs and shortens the form URL, and delivers it to the business owner via email.

Several significant deviations from plan occurred across the project:

**esbuild output format** — the initial compilation target was CJS. GAS V8 does not support the CommonJS `module` global, causing runtime failures. Switched to `iife` format.

**Webhook signature verification** — planned as HMAC-SHA256 verification on the `X-Moe-Signature-256` header. GAS `doPost` does not expose incoming HTTP request headers — making this impossible without a middleware layer. Verification was removed entirely from the codebase. Company ID filtering became the primary security control.

**`btoa` unavailable → double-encoded API key** — `btoa` is not available in the GAS V8 runtime. It was replaced with `Utilities.base64Encode` throughout. This exposed a second issue: the API key stored in Script Properties was already Base64-encoded. `Utilities.base64Encode(apiKey)` was therefore double-encoding it, producing a 401 on all MoeGo API calls. Fixed by using the key directly as `Basic ${apiKey}` without re-encoding.

**`GmailApp` → `MailApp`** — `GmailApp.sendEmail` throws "Gmail operation not allowed" in `ANYONE_ANONYMOUS` web app context. Replaced with `MailApp.sendEmail` and updated the OAuth scope from `gmail.send` to `script.send_mail`.

**Email deliverability failure** — emails were delivered to spam across all tested email clients. Zoho additionally blocked delivery outright with `554 5.7.7`. Root cause: the script was deployed under a Google account associated with a custom domain (`scottgilmore.dev`). `MailApp` always sends from the deploying account and does not support `From` overrides or Gmail send-as aliases. DKIM for custom domains requires Google Workspace — unavailable on personal Gmail. Fixed by adding a `@gmail.com` account as a user on the GAS project and redeploying with that account set as `Execute as`. The `Execute as` field only presents the currently signed-in user as an option — the Gmail account had to be the active session at deployment time. After redeployment, emails sent from `@gmail.com` landed in inbox across all tested clients including the business owner.

**Form URL pre-fill not working** — `FORM_ENTRY_*` script properties were missing the `entry.` prefix. Google Forms pre-fill parameters require the full `entry.XXXXXXXXXX` format.

**Health check graceful handling** — health check payloads have no customer object, causing `parseWebhookPayload` to throw before the event type check. Fixed by discriminating event type before customer field validation, returning a base `MoeGoEvent` for unsupported types instead of throwing.

**Supported event type changed during Milestone 6** — the original supported event was `CUSTOMER_CREATED`. During Milestone 6 this was changed to `APPOINTMENT_CREATED`. `SUPPORTED_EVENT_TYPE` was renamed to `SUPPORTED_EVENT_TYPES` as an array to support future expansion.

**`CUSTOMER_DELETED` unimplementable** — listed in MoeGo docs as a supported event type, but the MoeGo platform provides no mechanism for deleting customers. The event can never fire. Not implemented.

**No MoeGo sandbox** — the plan referenced a "live MoeGo sandbox" for end-to-end testing. MoeGo has no sandbox environment. All testing was against live production with a dedicated test customer (`TEST TESTEST`). A single test customer was reused throughout via `CUSTOMER_UPDATED` events as customers cannot be deleted.

**PII decisions made mid-project** — the original form design included first name, last name, and phone as pre-filled fields. During implementation a decision was made to exclude PII from the form entirely and pre-fill links only. The email identifies clients by first name and last initial only.

---

## Why the Difference

**GAS platform constraints were not researched thoroughly enough upfront.** The esbuild format requirement, `btoa` unavailability, `GmailApp` OAuth restrictions, and request header inaccessibility in `doPost` are all documented — they were researchable before planning began. The plan treated GAS as a thin runtime wrapper around standard TypeScript without verifying that assumption. A structured review of GAS platform constraints, available globals, module format requirements, and OAuth behavior by access level before Milestone 0 would have caught most of these.

**Third-party platform capabilities went unverified before planning.** The MoeGo sandbox assumption was taken from documentation without confirmation. The `CUSTOMER_DELETED` event was similarly assumed operational. Both were wrong. Verifying platform capabilities with a live test before scoping dependent milestones would have caught these gaps early.

**API key format was not explicitly specified in setup documentation.** Whether a stored credential should be raw or pre-encoded was ambiguous. The double-encoding failure was a direct consequence.

**Email delivery architecture was not fully evaluated before Milestone 5.** The constraints of `MailApp` in `ANYONE_ANONYMOUS` context, the relationship between deploying account identity and DKIM/DMARC authentication, and the `Execute as` options available in GAS were not assessed before implementation. A fuller evaluation upfront would have identified the Gmail account requirement before deployment.

**Form pre-fill configuration lacked specificity in setup docs.** `form-setup.md` identified that entry IDs were needed but did not specify the full `entry.XXXXXXXXXX` format required in the URL.

**Insufficient familiarity with GAS tooling and GCP.** The GAS editor did not recognize compiled iife functions — nothing could be executed from the editor directly. This was a consequence of the esbuild compilation approach and significantly hindered debugging. Whether alternative compilation strategies (e.g. Clasp's native TypeScript support) could preserve editor functionality while remaining GAS-compatible is an open question. GCP Stackdriver was eventually identified as the only reliable log access mechanism, but only after googling — it was not known upfront. Deeper familiarity with both the GAS UI (deployment lifecycle, test deployments, version management) and GCP would have reduced debugging friction considerably.

---

## Sustains

- **TDD discipline held throughout.** Every module was test-driven from the start. When GAS-specific failures emerged in production, the test suite provided a reliable baseline for isolating issues.
- **Modular architecture paid off.** Each concern (webhook, API client, form builder, shortener, email) was independently testable and replaceable. Swapping `GmailApp` for `MailApp`, changing the esbuild format, and removing signature verification all required localized changes only.
- **Graceful failure handling proved its value.** The partial and full failure email paths confirmed that the business owner would never be left without a recovery path regardless of upstream failures.
- **Company ID filtering as a pragmatic security boundary.** When signature verification proved impossible, the company ID filter provided a clean, maintainable alternative without requiring external infrastructure.

---

## Improvements

- **Audit GAS platform constraints before planning any GAS project.** Confirm available globals, module format requirements, OAuth behavior by access level, request object capabilities, and editor limitations. Do not assume web standard APIs are available.
- **Research GAS deployment lifecycle and GCP logging before starting.** Understand the difference between new deployments and new versions, the test deployment option, `Execute as` constraints, and how to access execution logs via GCP Stackdriver. Document findings for future reference.
- **Investigate alternative compilation strategies for GAS.** Determine whether Clasp's native TypeScript support or an alternative esbuild configuration could preserve GAS editor functionality without sacrificing runtime compatibility.
- **Verify third-party platform capabilities before planning.** Confirm sandbox availability, which webhook event types actually fire, API authentication format, and any platform-level constraints with a live test before scoping dependent milestones.
- **Document API key format expectations explicitly in setup docs.** Whether a stored credential is raw or pre-encoded must be unambiguous.
- **Fully evaluate email delivery architecture before Milestone 5 on any future GAS project.** Assess `MailApp` vs `GmailApp` constraints by access level, deploying account identity requirements for DKIM/DMARC, and `Execute as` options before writing any email code.
- **Complete form setup documentation.** Specify the full `entry.XXXXXXXXXX` format explicitly.
- **Consider middleware early for production webhook receivers.** The inability to verify webhook signatures in GAS `doPost` is a genuine security limitation. For any future project using GAS as a webhook target, a Cloudflare Worker or similar thin middleware layer should be evaluated upfront.

---

## Actions

| Action                                                                                                  | Owner           | By When            |
| ------------------------------------------------------------------------------------------------------- | --------------- | ------------------ |
| Update `form-setup.md` with explicit `entry.` prefix requirement                                        | scottgilmoredev | Next doc pass      |
| Add GAS platform constraints, deployment lifecycle, and GCP logging notes to project docs               | scottgilmoredev | Next doc pass      |
| Research Clasp native TS vs esbuild iife re: editor compatibility                                       | scottgilmoredev | Next GAS project   |
| Add middleware layer (signature verification) to `docs/enhancements.md` as post-MVP priority            | scottgilmoredev | Done — Milestone 6 |
| Document `CUSTOMER_DELETED` non-firing behavior and `Execute as` account requirement in deployment docs | scottgilmoredev | Next doc pass      |
