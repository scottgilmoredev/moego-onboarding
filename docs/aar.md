# After Action Review — moego-onboarding

---

**Date:** 2026-04-10
**Scope:** Milestones 7–10 — Custom Client Landing Page Phase
**Participants:** Solo

---

## What Was Planned

Milestones 7–10 replaced the Google Form-based onboarding flow with a custom per-client landing page. The plan: generate a unique expiring token per client, store it in ScriptProperties with the client's onboarding links, deliver a shortened token URL to the business owner, and serve a personalized HTML landing page via `doGet` that renders the client's agreements, card-on-file link, and vaccination record upload. Milestone 10 added first-time client detection via the MoeGo API, returning client skipping, token storage management, file upload improvements, and documentation cleanup.

The plan assumed the MoeGo Aggregation API (`LookupClientPetProfile`) would be accessible for first-time client detection, that esbuild globals would work for `google.script.run` callable functions the same way they did for `doPost`, and that all Script Property key names would be consistent between `.env.example` and the deployed project.

---

## What Actually Happened

All milestones shipped. The landing page flow is operational in production. Several significant deviations occurred:

**Aggregation API inaccessible** — `LookupClientPetProfile` is pure gRPC and not accessible from `UrlFetchApp`. Replaced with `POST /v1/appointments:list` filtered to `FINISHED` status, which is a REST endpoint and works correctly. `pageToken: "1"` is required in the pagination object or the API returns 500.

**`lastAppointmentDate` unreliable** — the initial first-time client check used `lastAppointmentDate` on the customer record. This field was observed to contain future dates (next appointment) rather than the most recent past appointment, producing false positives. Replaced with the `ListAppointments` approach above.

**GAS Drive error page from misconfigured Script Property** — `getConfig()` threw on `BUSINESS_OWNER_EMAIL` vs `BUSINESS_OWNER_EMAILS` mismatch. `doPost` had no top-level try/catch so the throw surfaced as a Drive error page. Multiple wrong diagnoses (auth, stale deployment, wrong URL) before root cause was identified via GCP logs. See postmortem: `2026-04-02-gas-drive-error-script-property.md`.

**`google.script.run` callable functions require top-level declarations** — `doGet` and `uploadVaccinationRecord` were assigned to `globalThis` following the same pattern as `doPost`. `google.script.run` requires genuine top-level function declarations, not `globalThis` assignments. Fixed via esbuild `banner` option. See postmortem: `2026-04-02-gas-globals-not-exposed-iife.md`.

**curl `-X POST` incompatible with GAS redirect** — GAS redirects POST requests. Using `-X POST` with `-L` causes curl to reissue the redirect as POST rather than GET, resulting in a redirect loop. The correct pattern is `-L` with `-d` (which implicitly sends POST) and without `-X POST`.

**Token deletion on upload revoked onboarding link access** — the initial upload implementation deleted the token after upload to prevent re-submission. Identified as incorrect — the token also stores the client's agreement and COF links. Replaced with an `uploaded: boolean` flag in the payload. Upload step renders as already-completed on page revisit if `payload.uploaded` is true.

**Drive folder ownership constraint** — the deploying account cannot access a Drive folder it doesn't own or have access to. Moving the folder to the owner's account required sharing it with the deploying Gmail account. `drive` OAuth scope grants full Drive access — no folder-scoped permissions exist in GAS.

---

## Why the Difference

**GAS platform constraints continued to surface despite prior phase learnings.** The `google.script.run` top-level declaration requirement and the Drive error page behavior are both GAS-specific constraints that were not researched before implementation. The prior AAR identified "audit GAS platform constraints before planning" as an improvement — this was not applied thoroughly enough going into this phase.

**The Aggregation API assumption was not verified before planning.** The API docs described `LookupClientPetProfile` without indicating it was gRPC-only. A live test before scoping would have caught this immediately.

**Script Property key naming was not validated before E2E testing.** A pre-E2E checklist that cross-references `.env.example` against deployed Script Properties would have caught the `BUSINESS_OWNER_EMAILS` mismatch before the first curl attempt.

**Token lifecycle design had an unconsidered dependency.** The initial decision to delete the token on upload did not account for the token being the only mechanism for accessing the onboarding links. A fuller review of what the token represents — not just a re-upload prevention mechanism but the client's entire onboarding session — would have caught this.

---

## Sustains

- **TDD discipline held throughout.** All features were test-driven. The mock sequence approach for `doPost` continued to provide reliable coverage of the full orchestration flow.
- **GCP logs as the primary debugging tool.** After the prior AAR, GCP logging was used immediately on the first E2E failure and identified the root cause within a single session.
- **Graceful failure handling extended cleanly.** Adding the `hasFinishedAppointments` failure path and the sheet write failure path required only localized changes — the failure handling architecture scaled well.
- **Modular token design.** `generateToken`, `storeToken`, `getToken`, and `purgeExpiredTokens` remained independently testable and composable throughout the phase.

---

## Improvements

- **Verify all third-party API transports before planning.** Confirm whether an endpoint is REST or gRPC before scoping any feature that depends on it from `UrlFetchApp`.
- **Cross-reference Script Properties against `.env.example` before first E2E test.** Add this as a required step in the E2E checklist.
- **Research `google.script.run` callable function requirements before implementing any client-callable GAS functions.** The distinction between web app entrypoints and `google.script.run` callable functions should be understood upfront.
- **Review the full token lifecycle before any change that touches token state.** The token is the client's onboarding session — any operation that modifies or deletes it must consider all downstream consumers.
- **Document Drive scope and folder ownership constraints before deploying to a new account.** The requirement to share the folder with the deploying account is non-obvious and should be in the setup docs before the first deployment attempt.

---

## Actions

| Action                                                                            | Owner           | By When           |
| --------------------------------------------------------------------------------- | --------------- | ----------------- |
| Add `google.script.run` banner pattern to `docs/clasp-setup.md`                   | scottgilmoredev | Done — 2026-04-10 |
| Document Drive scope limitations and shared folder setup in `docs/sheet-setup.md` | scottgilmoredev | Done — 2026-04-10 |
| Add pre-E2E Script Properties cross-reference step to `docs/e2e-testing.md`       | scottgilmoredev | Next doc pass     |
| Write postmortems for Drive error page and GAS globals incidents                  | scottgilmoredev | Done — 2026-04-10 |

---

---

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
