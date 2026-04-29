# After Action Review — moego-onboarding

---

**Date:** 2026-04-29
**Scope:** Production incident — transient bandwidth quota errors, two clients failed onboarding
**Participants:** Solo

---

## What Happened

Two onboarding flows failed on separate days due to transient GAS `UrlFetchApp` "Bandwidth quota exceeded" exceptions — one during `hasFinishedAppointments`, one during `getAgreementSignLink`. Both triggered full failure emails to the owner; two clients require manual retrigger.

---

## Root Cause Assessment

GAS `UrlFetchApp` has rolling-window rate limits in addition to daily totals. `doPost` makes 4–5 sequential `UrlFetchApp` calls in rapid succession; bursts can briefly exceed the short-window rate limit even when daily totals are well within quota. The errors were transient — retries immediately after both failures succeeded.

---

## What Changed

`fetchWithBandwidthRetry` added to `moego.ts` — catches "Bandwidth quota exceeded" exceptions, sleeps 2 seconds, retries once. Applied to both `fetchFromMoeGo` and `postToMoeGo`. Merged in PR for issue #143.

---

## What Failed

Two clients need manual retrigger. Both bandwidth quota failures sent full failure emails. Owner must run `retriggerOnboarding` for both affected customer IDs.

---

## Sustains

- **GCP logs identified root cause immediately.** Both bandwidth quota errors were diagnosed from logs without guesswork.
- **Retry is proportionate.** Single retry with 2s sleep handles the transient burst-rate case without over-engineering. Consistent with the failure handling philosophy throughout the project.

---

## Improvements

None specific to this incident beyond the fix already applied.

---

## Actions

| Action                                                                | Owner           | By When           |
| --------------------------------------------------------------------- | --------------- | ----------------- |
| Manual retrigger for two clients affected by bandwidth quota failures | scottgilmoredev | Immediate         |
| PR #143 merged — `fetchWithBandwidthRetry` in production              | scottgilmoredev | Done — 2026-04-29 |

---

---

**Date:** 2026-04-29
**Scope:** GAS OAuth consent screen — 7-day refresh token expiry requiring reauthorization
**Participants:** Solo

---

## What Happened

The script had been requiring OAuth reauthorization approximately every 7 days despite regular daily executions. Each reauth event broke the webhook until the owner manually re-ran the auth function.

---

## Root Cause Assessment

The OAuth consent screen was in "Testing" status in GCP. Google enforces a hard 7-day refresh token expiry for apps in Testing status regardless of usage frequency. This is documented behavior, not a platform bug.

---

## What Changed

OAuth consent screen published to Production status in GCP console. Eliminates the 7-day hard refresh token expiry.

---

## What Failed

Nothing failed permanently — the reauth was a recurring operational burden with a known fix that was not applied at launch.

---

## Sustains

- **GCP logs identified root cause immediately.** The reauth root cause was diagnosed from logs without guesswork.

---

## Improvements

- **Publish OAuth consent screen to Production before going live.** The Testing → Production transition should be part of the deployment checklist.

---

## Actions

| Action                                              | Owner           | By When           |
| --------------------------------------------------- | --------------- | ----------------- |
| OAuth consent screen published to Production        | scottgilmoredev | Done — 2026-04-29 |
| Add Production publish step to deployment checklist | scottgilmoredev | Next doc pass     |

---

---

**Date:** 2026-04-29
**Scope:** GAS platform investigation — mobile responsiveness and warning banner
**Participants:** Solo

---

## What Happened

A mobile responsiveness investigation revealed the landing page renders at desktop width on all mobile devices. An `addMetaTag` fix was implemented, deployed, and confirmed ineffective after inspecting the served outer HTML.

---

## Root Cause Assessment

GAS wraps all web app content in an outer wrapper HTML page controlled by Google's infrastructure. `HtmlOutput.addMetaTag()` adds meta tags to the inner sandboxed iframe content only — not the outer wrapper. The inner iframe's viewport meta tag is ignored by mobile browsers because the outer wrapper lacks one. The outer wrapper cannot be modified via any GAS API.

---

## What Changed

`addMetaTag` approach ruled out before merging — the code was written and pushed to PR #146 but never deployed. The outer wrapper HTML was inspected and confirmed to contain no viewport meta tag and no modifiable GAS API surface. No viable fix exists within the current GAS architecture. The outer wrapper is infrastructure-controlled and the short URL must point to the GAS deployment directly.

---

## What Failed

**`addMetaTag` code was written without first reading the evidence in hand.** The outer wrapper HTML was provided before implementation began and showed no viewport meta tag — sufficient to rule out `addMetaTag` as a solution before writing any code.

**No viable GAS-native fix exists for either issue.** Any real fix requires serving the landing page from a different host or accepting the current limitations.

---

## Sustains

Nothing to sustain — the investigation produced a confirmed dead end.

---

## Actions

| Action                                                                          | Owner           | By When      |
| ------------------------------------------------------------------------------- | --------------- | ------------ |
| Close PR #146 — `addMetaTag` approach invalid, no viable replacement within GAS | scottgilmoredev | Next session |
| Confirm owner copy for issue #145 (upload UX)                                   | scottgilmoredev | Next session |

---

---

**Date:** 2026-04-15
**Scope:** Production incident — premature token deletion, missing sheet row, developer unavailability
**Participants:** Solo

---

## What Happened

A client's onboarding landing page link stopped working before the 7-day expiry window. The script property storing the client's token was absent — either deleted prematurely or never written. Separately, the sheet row for this client was also missing, meaning neither the link nor the Customer ID were recoverable from the normal sources. The developer's internet connection went down around the same time, preventing any GAS editor access to retrigger. Links were delivered to the client manually as an emergency measure.

---

## Root Cause Assessment

The cause of the missing script property is unconfirmed. No code bug was identified in the token lifecycle:

- `purgeExpiredTokens()` only deletes entries where `expiresAt < Date.now()` — it cannot delete a non-expired token
- `getToken()` only deletes on access if the token is expired
- Config properties (e.g. `MOEGO_API_KEY`) cannot be misidentified as tokens — they fail `JSON.parse` and are skipped by the purge

Likely causes that cannot be ruled out:

- **GAS Script Properties storage cap** — GAS enforces a 500KB total limit across all script properties. If the limit was approached, a write may have silently failed, meaning the token was never stored despite `storeToken()` appearing to succeed
- **Manual deletion** — a GAS editor user with project access could have deleted script properties directly; no audit trail exists for this
- **GAS platform transient error** — `PropertiesService` writes can silently fail under GAS quota or rate limit conditions with no thrown exception

The missing sheet row is a separate issue and not covered here.

---

## What Failed

**Single owner dependency.** The developer was the only person who could retrigger the flow or recover a Customer ID. When the developer was unreachable, there was no recovery path available to the owner independently.

**No Customer ID recovery path.** The Customer ID (MoeGo API identifier) was stored only in the sheet. With the sheet row missing, there was no documented way for the owner to look it up without developer assistance. The MoeGo UI displays a numeric internal ID in the URL — this is not accepted by the API.

**No owner-accessible tooling.** The owner had no way to call the MoeGo API or Short.io directly without logging into separate dashboards and navigating unfamiliar interfaces.

---

## What Changed

**Postman collection added** — `docs/postman/` now contains a pre-configured collection and environment covering all external API calls: customer lookup by phone, Get Customer, agreement sign links, card-on-file link, finished appointments check, and URL shortening. The owner receives a populated copy (real values filled in) and can run any call independently.

**Customer ID lookup via phone** — `POST /v1/customers:list` with `filter.mainPhoneNumber` allows the owner to recover a Customer ID from the client's phone number alone. Phone must be provided without country code (e.g. `4049850300`) — E.164 format is rejected by this endpoint.

**`retrigger-guide.md` updated** — the customer ID lookup section now references the Postman guide as the recovery path when the sheet row is missing, replacing the prior instruction to contact the developer.

---

## Sustains

- **Graceful failure handling contained the blast radius.** The failure did not propagate silently — the missing token caused a clear error state rather than corrupt data.
- **`retriggerOnboarding` worked correctly once the Customer ID was recovered.** The retrigger mechanism introduced in Milestone 11 performed as designed once a valid Customer ID was obtained.

---

## Improvements

- **Investigate Script Properties write reliability.** Consider adding a read-back verification after `storeToken()` — write then immediately read the key and throw if the value is absent. This would surface silent write failures at the point of occurrence rather than at link access time.
- **Reduce developer as single point of failure.** The Postman collection is a mitigation. The deeper gap is that the owner has no way to independently trigger the GAS retrigger flow — this still requires GAS editor access. A future enhancement could expose `retriggerOnboarding` via a simple owner-facing UI or a protected HTTP endpoint.

---

## Actions

| Action                                                              | Owner           | By When           |
| ------------------------------------------------------------------- | --------------- | ----------------- |
| Add Postman collection, environment, and guide to `docs/postman/`   | scottgilmoredev | Done — 2026-04-16 |
| Update `retrigger-guide.md` with Postman-based Customer ID lookup   | scottgilmoredev | Done — 2026-04-16 |
| Add `retriggerOnboarding` owner-facing UI to `docs/enhancements.md` | scottgilmoredev | Next doc pass     |

---

---

**Date:** 2026-04-13
**Scope:** Milestone 11 — Owner Tooling & Sheet Management
**Participants:** Solo

---

## What Was Planned

Milestone 11 scoped three features: sheet structure improvements (#115 — column reorder, alphabetical insert, Vaccination Records column), writing the Drive file URL back to the sheet on upload (#122), and an owner re-trigger mechanism for expired or skipped clients (#123). File upload was assumed to be single-upload per client based on the existing `uploaded: boolean` flag.

---

## What Actually Happened

All issues shipped. Several unplanned fixes were required along the way:

**Multi-upload requirement discovered post-planning** — the `uploaded: boolean` flag permanently blocked re-upload after the first file. Post-launch it was recognized that clients with multiple pets need to upload one vaccination record per pet. A pet count analysis against live customer data (max 4 pets, avg 1.22) informed a cap of 5. `uploaded: boolean` was replaced with `uploadCount: number`, and file naming was updated to append a `_N` suffix on subsequent uploads to avoid Drive filename collisions. This was not in scope for Milestone 11 but was resolved as part of the same branch.

**`formatTimestamp` timezone fix silently regressed** — the function had previously been updated to use `Intl.DateTimeFormat` with `America/New_York`. During the `writeClientRow` refactor, the file was rewritten and the UTC implementation was restored. The regression was not caught until E2E testing, when timestamps in the sheet appeared as UTC rather than Eastern time.

**`sendPartialFailureEmail` was dead code** — the function was never called from `doPost` and referenced the old Google Form URL construction flow that was removed when the landing page replaced the form. It was not cleaned up during the Milestone 7–10 phase transition. Removed in Milestone 11 when the failure email copy was updated to reference `retriggerOnboarding`.

**Failure email copy referenced old Google Form recovery steps** — all three failure emails directed the owner to manually reconstruct a pre-filled form URL. These instructions were meaningless after the landing page replaced the form. Updated to reference `retriggerOnboarding` for the full failure case and simplified the Short.io and sheet write failure cases.

**`pointer-events: none` blocked cursor CSS on upload button states** — cursor styles (`progress`, `not-allowed`) were not applying to the upload button during and after upload. Root cause: `pointer-events: none` prevents CSS cursor properties from rendering even though it does not block JS-side event prevention. Removed from all upload button state classes.

---

## Why the Difference

**Multi-upload was a known edge case that was deferred without a plan.** The owner noted multi-pet clients during the upload cap discussion but no issue was created at the time. It surfaced as a real requirement only after the feature was in use.

**The timezone fix regression was caused by a full-file rewrite during refactoring.** When `writeClientRow` was restructured, the entire `sheet.ts` file was effectively rewritten without a line-by-line review of what was changing. A targeted edit to the alphabetical insert logic would not have touched `formatTimestamp`.

**Dead code from the form era was never audited after the landing page transition.** The Milestone 7–10 AAR did not include a review of whether all existing code paths still made sense in the new architecture. `sendPartialFailureEmail` and the failure email copy were direct casualties of this gap.

**`pointer-events: none` is a commonly misapplied CSS pattern.** It is frequently used to prevent user interaction but blocks cursor CSS as a side effect. The correct approach for preventing re-click without losing cursor feedback is JS-side event guarding, which was already in place.

---

## Sustains

- **TDD continued to catch regressions quickly.** The timezone regression and cursor issue were caught during E2E review rather than in production.
- **Incremental commits by concern worked well.** Breaking changes into focused commits (token model, file naming, sheet write, cursor states) made individual pieces reviewable and revertable.
- **Pet count analysis before setting the upload cap.** Using real customer data to justify the cap of 5 was the right approach — it avoided both an arbitrary limit and an open-ended one.

---

## Improvements

- **Review all touched functions when doing a file-level rewrite.** If a refactor requires restructuring a file significantly, treat it as a full re-review of every function in that file, not just the ones being changed.
- **Audit existing code paths when replacing a major flow.** When a significant architectural change ships (form → landing page, or similar), review all dependent functions for references to the old flow before closing the phase.
- **Create issues for known edge cases at the time they are identified.** If a limitation is noted during planning or review ("multi-pet clients may need multiple uploads"), capture it as an issue immediately rather than accepting it as a known gap with no tracking.

---

## Actions

| Action                                                                      | Owner           | By When           |
| --------------------------------------------------------------------------- | --------------- | ----------------- |
| Add pre-E2E Script Properties cross-reference step to `docs/e2e-testing.md` | scottgilmoredev | Done — 2026-04-13 |

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
| Add pre-E2E Script Properties cross-reference step to `docs/e2e-testing.md`       | scottgilmoredev | Done — 2026-04-13 |
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
