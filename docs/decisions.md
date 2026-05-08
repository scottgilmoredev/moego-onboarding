# Decision Log — moego-onboarding

## Automated CHANGELOG updates via Haiku on release publish — 2026-05-08

**Decision:** A GitHub Actions workflow calls `claude-haiku-4-5` on every published release to convert Release Drafter output into Keep a Changelog format entries and commit the result to `CHANGELOG.md` on `main`.

**Context:** Maintaining a `CHANGELOG.md` manually adds friction to the release process. Release Drafter already auto-generates release notes from PR titles and labels, but that output is raw and unsuitable for a polished changelog — entries need to be rewritten from the user's perspective, grouped by section, and stripped of internal-only changes. Manual curation was the only alternative without introducing automation.

**Alternatives considered:**

- Manual curation — accurate but requires developer effort on every release; easy to skip or deprioritize
- `semantic-release` or `conventional-changelog` — full-featured but opinionated toolchains that require commit message conventions and significant pipeline restructuring; disproportionate for a solo project
- GitHub auto-generated release notes — too raw for a changelog; lists every commit or PR title without summarization or grouping

**Rationale:** Haiku handles the summarization and reformatting task well at low cost. The release body from Release Drafter is already structured by label category, giving the model clean input. The GitHub Actions event payload provides the release body without shell escaping issues. Python stdlib (`urllib.request`, `json`, `re`) avoids adding any new dependencies to the pipeline.

**Consequences:** `CHANGELOG.md` is committed directly to `main` by `github-actions[bot]` on each release. If branch protection requiring PRs is ever enforced on `main`, the workflow will need to open a PR instead of pushing directly. `ANTHROPIC_API_KEY` must be set as a GitHub Actions secret. The Python script lives in `.github/scripts/update_changelog.py` — update the prompt there if the changelog format or categorization rules change.

**Status:** Decided

---

## Programmatic GAS deployment versioning via `clasp deploy` in CI — 2026-05-08

**Decision:** The deploy workflow runs `clasp deploy -i "$DEPLOYMENT_ID"` after `clasp push --force` to update the live GAS deployment to the newly pushed code automatically. Previously, updating the live deployment required manually clicking **Deploy → Manage deployments → Edit → New version** in the GAS editor after every CI push.

**Context:** `clasp push` only updates the HEAD of the script project — it does not affect the versioned deployment that serves live traffic. Without an explicit `clasp deploy` call, the URL continues to serve the code from whatever version was last manually deployed. This gap was discovered when CI appeared to deploy successfully but live behavior did not reflect the new code.

**Alternatives considered:**

- Manual "Edit deployment" after each merge — error-prone; easy to forget; creates drift between what CI pushed and what users are served
- Head deployment URL for live traffic — always runs latest saved code without versioning; not suitable for production as it requires a logged-in Google session and is undocumented behavior

**Rationale:** `clasp deploy -i <deploymentId>` updates an existing deployment in place, incrementing the GAS version number while preserving the deployment URL. This closes the gap between what CI pushes and what the live app serves. Deployment IDs are stable per environment and stored as GitHub secrets (`DEPLOYMENT_ID_STAGING`, `DEPLOYMENT_ID_PROD`).

**Consequences:** Two new secrets required per environment in GitHub → Settings → Environments. The deployment description is set to `"staging @ <sha>"` for staging and the release tag name for prod — visible in the GAS editor under Manage deployments for traceability. If a deployment ID changes (e.g. environment rebuild), the corresponding GitHub secret must be updated.

**Status:** Decided

---

## Release Drafter for automated release note generation — 2026-05-08

**Decision:** Release Drafter is used to automatically draft GitHub release notes by aggregating merged PR titles and organizing them by label category. The draft is updated on every merge to `main` and is reviewed and published manually when a release is cut.

**Context:** Release notes were being written entirely by hand at release time. With no automation, entries had to be reconstructed from git log or PR history, which was time-consuming and easy to miss. A structured approach to release notes was needed that aligned with the existing label conventions.

**Alternatives considered:**

- Manual release notes — already in place; required reviewing all merged PRs at release time with no drafting aid
- `semantic-release` — fully automated version bumping and publishing; too opinionated for this project's release cadence and requires strict conventional commit enforcement
- GitHub auto-generated release notes — built-in GitHub feature; produces a flat list of PR titles with no categorization or version resolution

**Rationale:** Release Drafter integrates directly with the existing label set (`feat`, `fix`, `refactor`, etc.) to categorize entries automatically. Version resolution is driven by labels — `feat` bumps minor, everything else bumps patch. The draft is always current so release notes require only a review pass, not reconstruction. Configuration lives in `.github/release-drafter.yml`.

**Consequences:** PRs must be consistently labeled for Release Drafter to categorize them correctly — unlabeled PRs appear in an Uncategorized section. The version resolver uses a `breaking` label for major bumps; this label is in the standard set. Release Drafter output feeds the automated CHANGELOG workflow — the two are coupled; changes to Release Drafter category names may require updates to the Haiku prompt in `.github/scripts/update_changelog.py`.

**Status:** Decided

---

## Upload metadata persisted in token payload for client-side pre-population — 2026-05-07

**Decision:** Each successful upload appends a `{ name, size, type }` entry to a `uploads` array in the token payload stored in ScriptProperties. On page reload, `doGet` passes the array to the template, which uses it to pre-populate the file row list with previously uploaded files.

**Context:** After the multi-file queue was introduced, clients who reloaded the page mid-session saw an empty file list even though their files had already been uploaded. The owner notification and sheet write had occurred, but the client had no visual confirmation on reload.

**Alternatives considered:**

- No persistence — client always starts fresh on reload; loses context for multi-file sessions
- Separate ScriptProperties key per upload — more granular but adds key management complexity and stays within the same storage medium
- Store in the sheet row — the sheet is write-only from the upload path; reading back from it on `doGet` would require a sheet lookup keyed on customer ID for every page load

**Rationale:** The token payload is already read on every `doGet` and passed to the template. Appending upload metadata to the existing payload adds zero additional storage reads. Storing `name`, `size`, and `type` (not the Drive URL) is sufficient for re-rendering the row — the URL is not needed client-side.

**Consequences:** `TokenPayload.uploads` is an optional array of `{ name: string; size: number; type: string; fileUrl?: string }`. `fileUrl` was added later as part of the batch notification design (see _Batch upload notification via stored Drive URLs_). The `uploads` array grows with each successful upload and is bounded by the upload cap of 5.

**Status:** Decided

---

## Magic byte validation as server-side file type check — 2026-05-07

**Decision:** `uploadVaccinationRecord` validates the actual file content against known magic byte sequences for PDF, JPEG, and PNG in addition to checking the client-submitted MIME type.

**Context:** Server-side MIME type validation alone checks only what the client claims the file is — the `type` field in a `FileReader` result is trivially spoofable. A client can submit `application/pdf` as the MIME type while the file content is anything else.

**Alternatives considered:**

- MIME type check only — fast but trivially bypassed by setting a correct MIME type header on any file
- Full file content parsing — would catch more edge cases but is disproportionate for this use case and not practical in GAS

**Rationale:** Magic bytes are the first N bytes of a file and are set by the file format itself, not by the client's declared MIME type. Checking them against known signatures for the three allowed types provides meaningful defense in depth with minimal overhead.

**Consequences:** GAS `Utilities.base64Decode` returns a signed Java byte array. Magic bytes above 127 (PNG's `0x89`, for example) arrive as negative values. All byte comparisons must use `(bytes[i] & 0xff) === byte` to mask to unsigned before comparison — using raw byte values against unsigned hex constants silently fails for any byte above 127.

**Status:** Decided

---

## Server-rendered token passed via DOM data attribute into IIFE client script — 2026-05-07

**Decision:** The client token is embedded in a `data-token` attribute on a container element at template render time and read from the DOM inside the upload script. It is not injected as a GAS scriptlet variable.

**Context:** The upload script is assembled from fragment files and wrapped in an IIFE by the esbuild build step. A GAS scriptlet (`<?= token ?>`) injects values into the outer page scope at render time. Variables in the outer page scope are not accessible inside an IIFE closure — `token` was `undefined` inside the script, causing every `uploadVaccinationRecord` call to receive no token.

**Alternatives considered:**

- Scriptlet variable injection — incompatible with IIFE scope; variables injected into the outer page scope are not visible inside the closure
- Pass token as a function argument from outside the IIFE — would require restructuring the assembly so the IIFE exposes an init function callable from the outer scope; more complex
- Global variable on `window` — works but pollutes the global namespace; data attribute is the standard pattern for this

**Rationale:** Reading from a DOM data attribute inside the IIFE is the established pattern for passing server-rendered values into encapsulated client scripts. It requires no structural changes to the assembly model and keeps the value scoped to the element that owns it.

**Consequences:** Any additional server-rendered values needed by the upload script should follow the same pattern — embed in a data attribute, read from the DOM inside the IIFE. Scriptlet injection into variables is not viable with the current assembly model.

**Status:** Decided

---

## Batch upload notification via stored Drive URLs — 2026-05-07

**Decision:** `uploadVaccinationRecord` does not send a notification email. Instead, it stores the Drive file URL in the `uploads` array in the token payload. A separate `sendBatchUploadNotification(token)` function reads all stored URLs from the payload and sends one email listing them all. The client calls it after the full upload queue completes.

**Context:** Multi-file upload (issue #145) caused per-file notification emails — one email per file per batch. With clients uploading up to 5 files, this created inbox spam for the business owner. The server-side upload function has no visibility into when a batch ends — only the client knows when `processQueue` is done.

**Alternatives considered:**

- Send one email per file — original behavior; unacceptable at scale with multi-file batches
- Server-side debounce via time-based GAS trigger — would delay the email by a fixed window and adds trigger lifecycle management complexity not warranted here
- Return the Drive URL from `uploadVaccinationRecord` and pass it from client to notification call — would require changing the return type and client-side accumulation; storing in the payload is simpler since the payload is already written on each upload

**Rationale:** Storing the Drive URL in the uploads array is zero additional storage cost — the payload is already written to PropertiesService on each upload. `sendBatchUploadNotification` reads what is already there. The client is the natural place to signal batch completion since it controls `processQueue`.

**Consequences:** `TokenPayload.uploads` entries now include `fileUrl?: string`. `sendUploadNotificationEmail` accepts `fileUrls: string[]` instead of a single `fileUrl`. `sendBatchUploadNotification` is exposed to the GAS runtime via the esbuild banner. If the client tab is closed mid-batch, the remaining files are not uploaded and no notification is sent for that session — acceptable given uploads are sequential and the owner sees Drive folder contents regardless.

**Status:** Decided

---

## Single retry on GAS bandwidth quota errors — 2026-04-29

**Decision:** `UrlFetchApp` calls in `fetchFromMoeGo` and `postToMoeGo` are retried once after a 2-second sleep when the error message includes "Bandwidth quota exceeded". All other errors propagate immediately without retry.

**Context:** Two production onboarding flows failed due to transient GAS `UrlFetchApp` bandwidth quota errors. The errors were burst-rate rolling-window limits, not daily quota exhaustion — retries immediately after both failures succeeded. The original no-retry policy treated all API errors identically, triggering full failure emails and requiring manual retrigger for two clients.

**Alternatives considered:**

- No retry — already in place; triggered failure emails for transient errors that resolved on their own within seconds
- Exponential backoff — adds complexity and execution time risk not warranted for a single known transient error class

**Rationale:** A single retry with a fixed 2-second sleep is the minimum change that handles the transient burst-rate case. The sleep gives the rolling window time to reset. Failure handling is unchanged — if the retry also fails, the exception propagates and the existing failure email fires.

**Consequences:** `fetchWithBandwidthRetry` wraps all `UrlFetchApp.fetch()` calls in both `fetchFromMoeGo` and `postToMoeGo`. Worst-case execution time increases by 2 seconds per retried call. `Utilities.sleep` must be mocked in tests. Partially supersedes _No retry on API failure_.

**Status:** Decided

---

## GAS outer wrapper unmodifiable — no viable fix within current architecture — 2026-04-29

**Decision:** No GAS API method can modify the outer wrapper HTML served by GAS infrastructure. The mobile viewport and warning banner issues are accepted limitations of the current GAS deployment.

**Context:** The landing page renders at desktop width on mobile devices. `HtmlOutput.addMetaTag()` was ruled out — it targets only the inner sandboxed iframe content, not the outer wrapper. The outer wrapper HTML was inspected directly and confirmed to contain neither a viewport meta tag nor any modifiable GAS API surface.

**Alternatives considered:**

- `addMetaTag()` — confirmed ineffective; targets inner iframe only
- Google Sites iframe embedding — ruled out; the per-client token is a query parameter that cannot be forwarded from a Sites URL to an embedded GAS iframe due to cross-origin restrictions and Sites' lack of custom JavaScript support
- Custom domain — not being pursued at this time
- GitHub Pages, Netlify, or Vercel — serve the landing page HTML from a static host, read the token client-side, call back to GAS for token validation; viable but requires architectural change

**Rationale:** Any real fix requires serving the landing page from a host that gives full control over the outer HTML. That architectural change is out of scope for now.

**Consequences:** Mobile responsiveness and warning banner are accepted limitations. PR #146 closed without merging. Any future fix requires revisiting the hosting architecture.

**Status:** Decided

---

## Client-side JS in separate file, not TypeScript module — 2026-04-30

**Decision:** Landing page client-side JavaScript lives in a dedicated `src/templates/upload.html` file injected at render time via `HtmlService.createHtmlOutputFromFile`. It is plain JavaScript, not TypeScript, and has no unit test coverage.

**Context:** The upload script grew large enough that keeping it inline in `landing.html` made the template hard to read and maintain. Three structures were considered: inline in HTML, separate injected file, and a TypeScript module in `src/` bundled into the HTML at build time.

**Alternatives considered:**

- Inline in HTML — no separation of concerns; template becomes unwieldy as script grows
- TypeScript module in `src/` with esbuild inlining — would enable Vitest unit test coverage; requires esbuild to emit the compiled output as an inline `<script>` block inside the HTML template at build time; not straightforward with the current `iife` bundle targeting GAS server-side code; out of scope for now

**Rationale:** Separate injected file is the minimum change that improves maintainability without requiring a build pipeline change. The upload script is primarily UI state management — the critical validation logic (MIME type, size, cap) is duplicated server-side and covered by server-side tests.

**Consequences:** Client-side upload logic has no unit test coverage. The TypeScript module approach remains the correct long-term solution if the client-side logic grows in complexity or correctness requirements increase. See also: _Unit-Tested Client-Side JavaScript_ in `docs/enhancements.md`.

**Status:** Decided

---

## Sheet insert order changed to most-recent-first — 2026-04-17

**Decision:** New client rows are inserted as the first data row (row 2), pushing existing rows down so the most recent entries are always at the top. Alphabetical insert by last name is abandoned.

**Context:** Alphabetical insert by last name was chosen at the time of the Milestone 11 sheet restructure for easy scanning. In practice the owner's primary use for the sheet is checking the most recently sent link, not looking up a specific client by name. Scrolling to find a new entry adds friction in the common case.

**Alternatives considered:**

- Retain alphabetical insert — benefits easy scanning for roster-style lookup; does not match the owner's actual access pattern

**Rationale:** Most-recent-first places the new entry at row 2 immediately after the header, directly where the owner looks. The alphabetical ordering benefit is outweighed by the recency access pattern.

**Consequences:** `writeClientRow` uses `insertRowBefore(2)` instead of scanning for an alphabetical insert position; falls back to `appendRow` when only the header row exists. Column structure and all other sheet behavior are unchanged from _Sheet column structure — 7-column layout with alphabetical insert by last name — 2026-04-13_.

**Status:** Decided

---

## Owner self-service tooling — Postman collection and customer ID lookup — 2026-04-16

**Decision:** Provide the business owner with a Postman collection pre-configured for all external API calls made by the script, along with documentation covering customer ID lookup by phone number, manual link generation, and URL shortening.

**Context:** A production incident on 2026-04-15 exposed a single point of failure: the owner had no way to recover a missing customer link without developer assistance. The developer's internet outage coincided with the incident, leaving no recovery path. Two gaps drove the tooling decision: (1) no documented way for the owner to look up a customer ID when the sheet row is absent, and (2) no way to manually generate or shorten onboarding links without access to the GAS editor or external dashboards.

**Alternatives considered:**

- Document manual API calls via curl — works but is inaccessible for a non-technical owner
- Owner logs into MoeGo and Short.io dashboards directly — requires separate logins and is not actionable for generating per-customer tokens
- Add a UI in the landing page or GAS sidebar for owner-facing operations — significantly higher effort; out of scope

**Rationale:** A pre-configured Postman collection with an environment file gives the owner a self-contained tool that requires no code knowledge. Each request is documented with its use case. Customer lookup by phone (`POST /v1/customers:list` with `filter.mainPhoneNumber`) is the key capability — it recovers the Customer ID from data the owner already has (client name and phone) without needing the sheet or developer access.

**Implementation note:** `filter.mainPhoneNumber` requires the phone number without country code (e.g. `4049850300`, not `+14049850300`). E.164 format is rejected by this endpoint.

**Consequences:** `docs/postman/` contains the collection JSON, environment JSON (placeholders committed; owner receives a populated copy out-of-band), and a usage guide. The collection must be updated when API calls in `src/moego/moego.ts` or `src/shortener/shortener.ts` change — see the sync checklist in `docs/postman/postman-guide.md`. The `retrigger-guide.md` is updated to reference the Postman guide for customer ID lookup when the sheet row is missing.

**Status:** Decided

---

## `uploadCount` replaces `uploaded` boolean — supports multiple vaccination record uploads with cap — 2026-04-13

**Decision:** `TokenPayload.uploaded: boolean` is replaced with `uploadCount: number`. Uploads are permitted up to a cap of 5. Each successful upload increments the count. The cap is enforced server-side in `uploadVaccinationRecord` before any Drive or sheet write occurs.

**Context:** The `uploaded: boolean` flag was introduced to prevent re-submission while preserving access to onboarding links. Post-launch it was recognized that clients with multiple pets need to upload a vaccination record for each pet. A boolean flag permanently blocks re-upload after the first file regardless of pet count.

**Alternatives considered:**

- Retain `uploaded: boolean` — blocks multi-upload entirely; unacceptable for multi-pet clients
- Unlimited uploads — no cap; acceptable risk but leaves the door open to accidental or malicious spam
- Per-pet tracking — more precise but requires the pet list to be fetched and stored at token generation time

**Rationale:** An upload count with a cap is the simplest model that covers the real use case. The cap of 5 was derived from a `ListAllPets` API analysis showing a maximum of 4 pets per customer across the owner's client base. 5 gives one slot of headroom. The count is stored in the token payload — no additional storage required.

**Consequences:** `TokenPayload` has `uploadCount?: number` (treated as 0 if absent). File naming appends a `_N` suffix (e.g. `_2`, `_3`) on subsequent uploads to avoid Drive filename collisions. The landing page upload step reflects current count and disables the upload control when the cap is reached. Supersedes _Token marked `uploaded` instead of deleted after vaccination record upload_.

**Status:** Decided

---

## Sheet column structure — 7-column layout with alphabetical insert by last name — 2026-04-13

**Decision:** The Google Sheet uses a fixed 7-column layout: Last Name (A), First Name (B), Phone (C), Customer ID (D), Onboarding Link (E), Sent At (F), Vaccination Records (G). New rows are inserted alphabetically by last name rather than appended to the bottom.

**Context:** The original sheet structure appended rows in arrival order and had no dedicated column for vaccination record tracking. The owner requested a column reorder to match how they naturally look up clients (by last name). Vaccination Records was added as a dedicated column when the file upload feature was scoped, replacing the pre-baked Drive URL column from the original design.

**Alternatives considered:**

- Append new rows to bottom — simpler to implement but produces an unordered list that grows harder to scan over time
- Drive URL column baked at row-write time — not viable since uploads happen after the row is written

**Rationale:** Alphabetical order by last name gives the owner a scannable roster without sorting. Customer ID in a fixed column (D) is required by `writeVaccinationRecord` for O(n) row lookup at upload time. Vaccination Records in the last column (G) allows the upload handler to append entries without needing to know the full row structure.

**Consequences:** `writeClientRow` uses `insertRowBefore` rather than `appendRow`. Row lookup in `writeVaccinationRecord` scans column D for a matching Customer ID. Multiple vaccination record entries are newline-separated within a single cell. `formatTimestamp` uses `Intl.DateTimeFormat` with `America/New_York` for consistent Eastern time display.

**Status:** Decided

---

## Vaccination record filename convention — `LastName_FirstName_vaccination.ext` — 2026-04-13

**Decision:** Uploaded vaccination record files are renamed to `LastName_FirstName_vaccination.ext` in Google Drive. Subsequent uploads by the same client append a numeric suffix: `_2`, `_3`, etc.

**Context:** Clients upload files from their own devices with arbitrary filenames (e.g. `IMG_4521.jpg`, `photo.png`). Without renaming, the Drive folder becomes unidentifiable as volume grows.

**Alternatives considered:**

- Retain original filename — unidentifiable at volume
- Rename with timestamp only — sortable but not immediately identifiable by client

**Rationale:** Last name first matches how the owner looks up clients. Including `vaccination` in the filename makes the file type immediately clear without opening it. The numeric suffix on subsequent uploads avoids Drive creating duplicate-named files (`vaccination (1).jpg`) and matches the sheet entry count.

**Consequences:** `uploadVaccinationRecord` resolves the filename from the token payload. If the token cannot be resolved (edge case), the original filename is preserved as a fallback. The suffix counter is derived from `uploadCount` at the time of upload, so suffixes are deterministic across sessions.

**Status:** Decided

---

## ~~Token marked `uploaded` instead of deleted after vaccination record upload — 2026-04-10~~

**Superseded by:** _`uploadCount` replaces `uploaded` boolean — supports multiple vaccination record uploads with cap — 2026-04-13_

**Decision:** After a successful vaccination record upload, the token payload is updated with `uploaded: true` rather than deleted from ScriptProperties.

**Context:** The initial implementation deleted the token on upload to prevent re-submission. This was identified as incorrect — the token also stores the client's onboarding links (service agreement, SMS agreement, card on file). Deleting the token on upload would revoke access to those links before the client has necessarily completed those steps.

**Alternatives considered:**

- Delete token on upload — prevents re-upload but locks the client out of onboarding links if they haven't completed the other steps first
- No post-upload state change — allows unlimited re-uploads for the life of the token

**Rationale:** Tracking `uploaded: true` in the payload preserves link access while preventing re-upload. On page load, `doGet` passes the full payload to the template — the upload step renders as already-completed if `payload.uploaded` is true.

**Consequences:** `TokenPayload` has an optional `uploaded` field. `uploadVaccinationRecord` calls `setProperty` with the updated payload after a successful upload. Multiple uploads within a single session are still technically possible if the client does not refresh the page — the client-side button disable covers this case. The owner has noted this edge case is acceptable for now and wants to observe real usage before adding additional constraints.

**Status:** Decided

---

## First-time client check migrated to `ListAppointments` — 2026-04-02

**Decision:** Replace `lastAppointmentDate` on the customer record with a `POST /v1/appointments:list` call filtered to `FINISHED` status as the mechanism for detecting returning clients.

**Context:** `lastAppointmentDate` on the `MoeGoCustomer` object proved unreliable — observed values include future dates, suggesting the field reflects next appointment date in some or all cases. The MoeGo Aggregation API (`LookupClientPetProfile`) was considered as an alternative but is pure gRPC and inaccessible from `UrlFetchApp`. `ListAppointments` is a REST endpoint that accepts a `filter.statuses` array — filtering to `FINISHED` and checking for a non-empty result is a reliable signal that the client has at least one completed appointment on record.

**Alternatives considered:**

- Retain `lastAppointmentDate` — confirmed unreliable; produces false positives for new clients with upcoming appointments
- `LookupClientPetProfile` (Aggregation API) — purpose-built but gRPC-only; not accessible from GAS `UrlFetchApp`
- Check `AgreementRecord.signedStatus` — not accessible via the API

**Rationale:** `ListAppointments` with `FINISHED` status filter is the most reliable available REST signal for confirmed completed appointments. An empty `appointments` array confirms the client is new.

**Consequences:** `doPost` requires an additional API call after `getCustomer` — `hasFinishedAppointments` with the customer ID, company ID, and business ID. The `lastAppointmentDate` field and related logic are removed. `MoeGoCustomer` type updated accordingly. Pagination must include `pageToken: "1"` or the API returns 500. **Known edge case:** a client who completes an appointment without finishing onboarding will be permanently skipped on all future webhooks. The owner must manually re-trigger onboarding for these clients — no automated mechanism exists yet.

**Status:** Decided

---

## `APPOINTMENT_CREATED` trigger scoped to first-time clients only — 2026-03-30

**Decision:** `doPost` skips onboarding for customers who have a `lastAppointmentDate` on their MoeGo customer record, treating its presence as confirmation the client has already completed at least one appointment and can be assumed onboarded.

**Context:** The initial implementation triggered the full onboarding flow on every `APPOINTMENT_CREATED` event regardless of whether the customer was new. This caused the owner to receive onboarding notifications for returning clients who had already been onboarded, creating unnecessary noise. The MoeGo Agreement API documents an `AgreementRecord` object that would allow precise signed-status checking per client, but despite being documented it is not exposed via the API at this time. `lastAppointmentDate` is available on the customer record and serves as a reliable proxy — a customer with a prior appointment has already been through onboarding.

**Alternatives considered:**

- Check `AgreementRecord.signedStatus` — not accessible via the API; documented but not implemented by MoeGo
- No filter — triggers onboarding on every appointment for all clients; produces noise for returning clients
- Maintain a separate internal list of onboarded customers — adds state management complexity with no benefit over the `lastAppointmentDate` proxy

**Rationale:** `lastAppointmentDate` is the most reliable available signal for "has completed at least one appointment." It requires no additional API calls and no internal state. If MoeGo exposes `AgreementRecord` in future, that would be the preferred mechanism and this check should be updated.

**Consequences:** Customers rebooked before completing onboarding on their first appointment will be silently skipped. This is an accepted edge case. This decision also exposed a process gap: the trigger condition was never formally specified before implementation. Requirements for webhook handlers should explicitly define the target client population going forward.

**Status:** Decided

---

## `APPOINTMENT_CREATED` and `CUSTOMER_CREATED` have different payload shapes — 2026-03-29

**Decision:** Treat `APPOINTMENT_CREATED` and `CUSTOMER_CREATED` as distinct payload contracts with different nested structures.

**Context:** When the supported event type was changed from `CUSTOMER_CREATED` to `APPOINTMENT_CREATED`, the webhook validator was not updated to reflect the payload shape difference. `CUSTOMER_CREATED` events nest customer data under `customer`. `APPOINTMENT_CREATED` events nest appointment data under `appointment` with only a `customerId` reference — no customer object is present. Customer details must be fetched separately via `GET /v1/customers/{id}` after the webhook is parsed.

**Alternatives considered:**

- Assume payload shapes are consistent across event types — incorrect; confirmed via delivery log review

**Rationale:** Each MoeGo event type has its own payload contract. Validators, types, and downstream field references must be updated atomically whenever the supported event type changes.

**Consequences:** `getCustomer()` is called in `doPost` after webhook parsing to retrieve customer details. `MoeGoAppointment` interface added. `REQUIRED_APPOINTMENT_FIELDS` replaces `REQUIRED_CUSTOMER_FIELDS` as the active validation constant — the latter is preserved for potential future `CUSTOMER_CREATED` handling.

**Status:** Decided

---

## `APPOINTMENT_CREATED` replaces `CUSTOMER_CREATED` as supported event — 2026-03-27

**Decision:** `APPOINTMENT_CREATED` is the supported webhook event type. `CUSTOMER_CREATED` is no longer handled.

**Context:** Customers created via phone call in MoeGo are assigned placeholder names (e.g. `*123 CALL_IN`). This makes `CUSTOMER_CREATED` an unreliable trigger — the business owner cannot meaningfully act on a client with a placeholder name, and these customers frequently never book an appointment. The business owner expressed a preference for triggering onboarding at the point of appointment creation, when the client relationship is confirmed.

**Alternatives considered:**

- Retain `CUSTOMER_CREATED` — unreliable due to placeholder names on phone-created customers
- Support both — creates ambiguity about when the flow should trigger; not needed at this stage

**Rationale:** `APPOINTMENT_CREATED` reflects the point at which the business owner has a confirmed client relationship and can meaningfully send an onboarding form.

**Consequences:** All references to `CUSTOMER_CREATED` as the supported event updated throughout codebase and docs. `SUPPORTED_EVENT_TYPE` renamed to `SUPPORTED_EVENT_TYPES` array to accommodate future expansion.

**Status:** Decided

---

## `SUPPORTED_EVENT_TYPES` as array — 2026-03-27

**Decision:** `SUPPORTED_EVENT_TYPES` is defined as an array rather than a single string constant.

**Context:** When the supported event type changed from `CUSTOMER_CREATED` to `APPOINTMENT_CREATED`, it was recognized that future milestones may need to handle additional event types. A scalar constant would require a breaking change to extend.

**Alternatives considered:**

- Single string constant — simpler but requires refactoring to support multiple event types later

**Rationale:** Minimal additional complexity now; avoids a structural refactor if additional event types are added post-MVP.

**Consequences:** Event type checks use `Array.includes()` rather than strict equality. Type casting required in the include check due to GAS/TypeScript type constraints.

**Status:** Decided

---

## Webhook scoped to single company via `organizations` field — 2026-03-26

**Decision:** The MoeGo webhook registration includes an `organizations` filter scoped to the business owner's company.

**Context:** The webhook was initially registered without specifying an `organizations` filter. MoeGo scoped the webhook to all customer events across all companies, resulting in events from unrelated MoeGo companies being delivered to the endpoint. With signature verification not in place, there was no cryptographic mechanism to reject these foreign events. The webhook was re-registered with the `organizations` filter to restrict delivery to the configured company only.

**Alternatives considered:**

- No `organizations` filter — delivers events from all companies; unacceptable

**Rationale:** Scoping to the configured company at the webhook registration level is the correct place to enforce this boundary — it prevents unnecessary deliveries entirely rather than filtering them at the application level.

**Consequences:** Only events from the configured company are delivered to the endpoint. The company ID filter in `doPost` provides a secondary check in case of misconfiguration.

**Status:** Decided

---

## Company ID filtering as primary security control — 2026-03-26

**Decision:** Company ID filtering (`event.companyId !== config.moegoCompanyId`) is the primary mechanism for rejecting unauthorized webhook deliveries at the application level.

**Context:** Webhook signature verification was removed when GAS `doPost` was found to not expose incoming HTTP request headers. An alternative application-level security control was needed. See also: _Webhook signature verification removed_.

**Alternatives considered:**

- URL-based secret parameter — MoeGo webhook secrets are visible in plaintext via the `ListWebhooks` API response, offering no meaningful additional protection
- No filtering at all — unacceptable; any actor with the endpoint URL could trigger the flow

**Rationale:** Company ID is present in the webhook payload body, which is accessible in `doPost`. It provides a meaningful secondary filter without requiring header access or external infrastructure.

**Consequences:** Any actor who knows the endpoint URL and can construct a payload with the configured company ID could trigger the flow. This is an accepted risk for a single-location internal deployment. Middleware-based signature verification remains the correct long-term solution.

**Status:** Decided

---

## Webhook signature verification removed — 2026-03-26

**Decision:** HMAC-SHA256 webhook signature verification is not implemented. `verifyWebhookSignature` was removed from the codebase.

**Context:** GAS `doPost` receives a `GoogleAppsScript.Events.DoPost` event object. Incoming HTTP request headers are not exposed — `e.parameter` contains only URL query parameters. The `X-Moe-Signature-256` header required for HMAC verification is inaccessible.

**Alternatives considered:**

- URL-based secret — MoeGo webhook secrets are visible in the `ListWebhooks` API response; no meaningful security improvement
- Middleware layer (Cloudflare Worker) — routes the webhook through an intermediary that can access headers and verify the signature before forwarding to GAS; correct solution but adds infrastructure complexity not warranted for MVP

**Rationale:** Verification is impossible in the GAS runtime without a middleware layer. Company ID filtering is used as the primary security control in the interim.

**Consequences:** The endpoint has no cryptographic verification of request origin. Documented as a known limitation. Middleware layer added to `docs/enhancements.md` as a post-MVP priority.

**Status:** Decided

---

## `MailApp` over `GmailApp` — 2026-03-26

**Decision:** `MailApp.sendEmail` is used for all email delivery. `GmailApp` is not used.

**Context:** `GmailApp.sendEmail` throws "Gmail operation not allowed" when called from a GAS web app deployed with `ANYONE_ANONYMOUS` access. This is a documented GAS platform constraint.

**Alternatives considered:**

- `GmailApp` — not permitted in `ANYONE_ANONYMOUS` context
- External SMTP via `UrlFetchApp` — viable but adds dependency and configuration complexity not warranted for MVP
- Change access level to `ANYONE` — would require callers to have a Google account; MoeGo webhook requests are unauthenticated and would be blocked

**Rationale:** `MailApp` is the GAS-native email service compatible with `ANYONE_ANONYMOUS` deployments. OAuth scope updated from `gmail.send` to `script.send_mail`.

**Consequences:** `MailApp` sends from the deploying account with no `From` override capability. Deploying account identity directly affects email authentication. See also: _Deploy under `@gmail.com` account_.

**Status:** Decided

---

## Deploy under `@gmail.com` account — 2026-03-27

**Decision:** The GAS project is deployed under a `@gmail.com` account, not the `scottgilmore.dev` Google account.

**Context:** `MailApp` sends from the deploying account with no override. The `scottgilmore.dev` account lacks DKIM signing (requires Google Workspace). Without DKIM, outbound email failed DMARC checks and was delivered to spam or rejected outright by Zoho MX.

**Alternatives considered:**

- Google Workspace for `scottgilmore.dev` — would enable DKIM but incurs cost and is disproportionate for this project
- External SMTP service — viable long-term but adds infrastructure complexity
- Remain on `scottgilmore.dev` account — confirmed to produce consistent spam delivery

**Rationale:** `@gmail.com` accounts have DKIM signing handled by Google automatically. Email passes SPF, DKIM, and DMARC checks and lands in inbox. The Gmail account was added as a user on the GAS project and set as `Execute as` at deployment time — the `Execute as` field only presents the currently signed-in user as an option.

**Consequences:** The business owner receives email from the Gmail address associated with the deployment account. This is an acceptable UX tradeoff for MVP.

**Status:** Decided

---

## `Utilities.base64Encode` over `btoa` — 2026-03-26

**Decision:** `Utilities.base64Encode` is used for Base64 encoding in the GAS runtime. `btoa` is not used.

**Context:** `btoa` is not available in the GAS V8 runtime. Any call to `btoa` throws `ReferenceError: btoa is not defined` at runtime.

**Alternatives considered:**

- `btoa` — unavailable in GAS V8
- Custom Base64 implementation — unnecessary given `Utilities.base64Encode` is available as a GAS global

**Rationale:** `Utilities.base64Encode` is the GAS-native equivalent and accepts both strings and byte arrays directly.

**Consequences:** `Utilities` must be mocked in Vitest tests. The API key stored in Script Properties must be raw (not pre-encoded) — `Utilities.base64Encode` encodes it at runtime. See also: _MoeGo API 401 postmortem_.

**Status:** Decided

---

## `iife` over CJS esbuild output format — 2026-03-26

**Decision:** esbuild compiles to `iife` (immediately invoked function expression) format for GAS deployment.

**Context:** The initial esbuild configuration used CJS output format. GAS V8 does not support the CommonJS `module` global — the compiled bundle threw `ReferenceError: module is not defined` on first deployment.

**Alternatives considered:**

- CJS — not supported in GAS V8 runtime
- ESM — GAS V8 does not support ES module syntax natively
- Clasp native TypeScript — Clasp 3.x no longer compiles TypeScript directly; esbuild is required

**Rationale:** `iife` produces a self-executing bundle with no module system dependency, which is compatible with the GAS V8 runtime. No globals are leaked; the entrypoint is explicitly exposed via `globalThis`.

**Consequences:** The compiled entrypoint (`doPost`) must be explicitly exposed on `globalThis` for the GAS runtime to locate it. The GAS editor does not recognize compiled iife functions — nothing can be executed directly from the editor. See also: _`doPost` exposed via `globalThis`_.

**Status:** Decided

---

## `doPost` exposed via `globalThis` — 2026-03-26

**Decision:** `doPost` is explicitly exposed on `globalThis` at the bottom of `server.ts`: `(globalThis as unknown as Record<string, unknown>).doPost = doPost`.

**Context:** esbuild `iife` format wraps the entire bundle in a self-executing function. Functions defined inside are not visible to the GAS runtime unless explicitly placed on the global scope.

**Alternatives considered:**

- Rely on GAS to find the function — not possible with iife output; the function is not in global scope without explicit exposure

**Rationale:** Explicitly assigning to `globalThis` is the documented pattern for exposing functions from an iife bundle to a runtime that requires named globals.

**Consequences:** Any function that needs to be callable by the GAS runtime (e.g. future `doGet`) must be explicitly exposed on `globalThis` in the same manner.

**Status:** Decided

---

## PII excluded from form pre-fill — 2026-03-26

**Decision:** The pre-filled Google Form URL contains only agreement and COF links. No customer PII (name, phone) is included.

**Context:** The original form design included first name, last name, and phone as pre-filled fields. During implementation it was recognized that pre-filling PII creates a data trail: Short.io stores the destination URL, and the pre-filled form URL containing PII would be stored on Short.io servers.

**Alternatives considered:**

- Pre-fill all fields including PII — simpler for the business owner but stores PII on Short.io
- Pre-fill name only, not phone — partial mitigation but still stores PII externally

**Rationale:** Limiting pre-fill to links only means Short.io stores only agreement and COF URLs — neither of which is personally identifiable without accompanying customer data. The business owner has the customer's name and phone in MoeGo already.

**Consequences:** The form fields for name, phone, and any other PII must be completed manually by the business owner before sending. The email to the business owner identifies the client by first name and last initial only.

**Status:** Decided

---

## Email identifies client by first name and last initial only — 2026-03-26

**Decision:** The business owner email identifies the client as `${firstName} ${lastName.charAt(0)}.` — not full name.

**Context:** The email is sent to the business owner's inbox. Including the client's full name in the email subject and body is unnecessary for the business owner to act on it, and minimizes PII in email delivery infrastructure.

**Alternatives considered:**

- Full name — more explicit but unnecessary PII in email
- Customer MoeGo ID only — insufficient for the business owner to identify the client at a glance

**Rationale:** First name and last initial provides sufficient identification for the business owner while minimizing PII exposure in email.

**Consequences:** Consistent across all email types — success, partial failure, and full failure.

**Status:** Decided

---

## Sequential MoeGo API calls with individual try/catch — 2026-03-26

**Decision:** The three MoeGo API calls (`serviceAgreementUrl`, `smsAgreementUrl`, `cofUrl`) are made sequentially with individual try/catch blocks, not in parallel via `UrlFetchApp.fetchAll`.

**Context:** The partial failure design requires knowing which specific calls succeeded and which failed. This is straightforward with sequential individual calls.

**Alternatives considered:**

- `UrlFetchApp.fetchAll` — makes all requests in parallel; more efficient but requires additional logic to map results back to individual fields and handle per-call failures

**Rationale:** Sequential calls with individual try/catch is simpler to reason about and maintain at MVP scale. The performance difference is negligible given GAS execution limits.

**Consequences:** Total execution time is the sum of all three API call durations. A TODO to refactor to `UrlFetchApp.fetchAll` was added for post-MVP. Well within the GAS 6-minute execution limit.

**Status:** Decided

---

## No retry on API failure — 2026-03-26

**Decision:** Failed MoeGo or Short.io API calls are not retried. Each call is attempted once.

**Context:** The development plan explicitly scoped out automated retry. GAS imposes a 6-minute execution limit. Retry logic with backoff would increase execution time and complexity.

**Alternatives considered:**

- Single retry on failure — would double worst-case execution time per failing call
- Exponential backoff — adds significant complexity and execution time risk

**Rationale:** The graceful failure email path already provides the business owner with everything needed for manual recovery. Retrying at the GAS layer adds risk without meaningful benefit for an internal single-location deployment.

**Consequences:** Any transient API failure results in a partial or full failure email. The business owner must act on these manually. Monitoring for failure email frequency is the signal for whether retry logic is warranted.

**Status:** Decided

---

## `ANYONE_ANONYMOUS` access level — 2026-03-26

**Decision:** The GAS web app is deployed with `access: ANYONE_ANONYMOUS`.

**Context:** MoeGo webhook requests are unauthenticated HTTP POST requests from MoeGo's servers. There is no mechanism to attach a Google identity to these requests.

**Alternatives considered:**

- `ANYONE` — requires callers to have a Google account; blocks unauthenticated MoeGo requests
- `DOMAIN` — restricts to users within a Google Workspace domain; not applicable
- `MYSELF` — restricts to the deploying user only; blocks all external requests

**Rationale:** `ANYONE_ANONYMOUS` is the only access level that permits unauthenticated external HTTP requests, which is required for a webhook receiver.

**Consequences:** `GmailApp` is not available in this context — `MailApp` must be used instead. The endpoint is publicly accessible by URL. Company ID filtering is the primary security control.

**Status:** Decided

---

## GAS standalone web app over container-bound — Pre-development

**Decision:** The GAS project is a standalone web app, not bound to a Google Sheet, Doc, or other container.

**Context:** GAS projects can be standalone or bound to a Google Workspace document. This project has no dependency on any Google document — it is a pure webhook receiver and API orchestrator.

**Alternatives considered:**

- Container-bound (e.g. bound to a Sheet) — would allow the Sheet to serve as a simple operational dashboard, but adds an unnecessary dependency and complicates deployment

**Rationale:** Standalone is the correct model for a pure web app with no document dependency. Simpler to deploy, version, and maintain.

**Consequences:** Deployment is via Clasp with a standalone script ID. No Google document is required.

**Status:** Decided

---

## Short.io for URL shortening — Pre-development

**Decision:** Short.io is the URL shortening service for pre-filled form URLs.

**Context:** Pre-filled Google Form URLs with multiple encoded parameters can be very long — potentially spanning multiple SMS segments when sent to clients. A URL shortener reduces the link to a manageable length.

**Alternatives considered:**

- Bitly — free tier too restrictive for API usage; paid plan not warranted
- TinyURL — no reliable free API
- Custom shortener — significant additional development effort; out of scope for MVP
- No shortening — full URL fallback is implemented, but long URLs may span multiple SMS segments

**Rationale:** Short.io's free tier provides 1,000 total links — sufficient for a single-location business onboarding new clients annually. Private API key support is available on the free tier. Short.io stores destination URLs which includes the agreement and COF links — acceptable given these are not personally identifiable without accompanying customer data.

**Consequences:** Short.io stores all shortened destination URLs. Free tier limit is 1,000 total links — old links can be deleted to stay within limit. If Short.io is unavailable, the full unshortened URL is delivered with an advisory note.

**Status:** Decided

---

## Google Apps Script as runtime — Pre-development

**Decision:** Google Apps Script is the deployment target for the webhook receiver and onboarding flow.

**Context:** The business owner uses Google products (Gmail, Google Forms) and has an existing Google account. A serverless deployment that integrates natively with Google services avoids the need for a separate hosting account, billing setup, or infrastructure management.

**Alternatives considered:**

- AWS Lambda — viable but requires AWS account, billing, and more complex deployment pipeline
- Cloudflare Workers — excellent fit technically but requires a Cloudflare account and introduces a new platform for the business owner to manage
- Express on a VPS — full control but requires server management, uptime monitoring, and cost

**Rationale:** GAS is free, requires no infrastructure management, integrates natively with Gmail and Google Forms, and the business owner already has a Google account. The tradeoff is GAS platform constraints — execution limits, restricted APIs by access level, no header access in `doPost`.

**Consequences:** All GAS platform constraints apply throughout the project. Compilation via esbuild is required. Clasp 3.x is used for deployment.

**Status:** Decided

---

## esbuild for TypeScript compilation — Pre-development

**Decision:** esbuild compiles TypeScript source from `src/` to `dist/` before Clasp pushes to GAS.

**Context:** Clasp 3.x no longer handles TypeScript compilation directly. A separate compilation step is required.

**Alternatives considered:**

- `tsc` — produces CJS or ESM output; CJS not supported in GAS V8, ESM requires additional handling; slower than esbuild
- Clasp 2.x with built-in TypeScript — older version with less reliable TypeScript support; not maintained at the same level

**Rationale:** esbuild is fast, handles TypeScript natively, and produces a single bundled output file — ideal for GAS which works best with minimal file count. Supports `iife` output format required for GAS V8 compatibility.

**Consequences:** esbuild configuration lives in `esbuild.config.js`. Output format must be `iife`. Entrypoint functions must be explicitly exposed on `globalThis`. The GAS editor will not recognize compiled functions.

**Status:** Decided

---

## Vitest over Jest — Pre-development

**Decision:** Vitest is the test runner for all TypeScript testing.

**Context:** The project uses NodeNext ESM modules throughout. Jest requires additional transform configuration (`ts-jest` or Babel) to work with ESM and TypeScript, adding setup overhead.

**Alternatives considered:**

- Jest — widely adopted but requires transform pipeline for ESM/TypeScript; additional configuration overhead not justified for a greenfield project
- Node.js built-in test runner — available since Node 18 but lacks watch mode, coverage integration, and the developer experience that Vitest provides

**Rationale:** Vitest is ESM-native, requires minimal configuration with TypeScript, and provides a Jest-compatible API. Well suited for a project using NodeNext modules.

**Consequences:** All test files use Vitest imports. Coverage via `@vitest/coverage-v8`. CI runs `vitest run`. GAS globals must be mocked via `vi.stubGlobal`.

**Status:** Decided

---

## pnpm over npm — Pre-development

**Decision:** pnpm is the package manager for this project.

**Context:** Package manager selection was made at project initialization. pnpm offers faster installs, strict dependency isolation, and efficient disk usage via content-addressable storage.

**Alternatives considered:**

- npm — default Node.js package manager; slower installs, less strict dependency resolution
- yarn — comparable feature set to pnpm but less momentum in recent tooling ecosystem

**Rationale:** pnpm is the preferred package manager for new projects. Consistent with personal development standards.

**Consequences:** `pnpm-lock.yaml` is committed. Contributors must have pnpm installed. CI uses pnpm via `pnpm/action-setup`.

**Status:** Decided
