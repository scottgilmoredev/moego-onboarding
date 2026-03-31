# Development Plan — moego-onboarding

## 1. Project Overview

**Goal:**
Enable a MoeGo-based pet service business owner to automatically receive a shortened client onboarding link via email whenever a new client books an appointment in MoeGo. The link directs the client to a hosted landing page with pre-populated agreement sign links, a card-on-file link, and a vaccination record upload field.

**Core Requirements:**

- TypeScript + Node.js (ESM, NodeNext)
- Google Apps Script (standalone web app via Clasp)
- Vitest for testing with full coverage
- ESLint Airbnb config
- Apps Script globals mocked for testability
- Strict TDD
- CI/CD via GitHub Actions
- Fully documented with JSDoc

---

## 2. Architecture

MoeGo fires `APPOINTMENT_CREATED` webhook → Apps Script `doPost` receives and validates payload → first-time client check (skip returning clients) → MoeGo API calls retrieve Service Agreement sign link, SMS Agreement sign link, and card-on-file link → token generated and stored in PropertiesService → Short.io shortens the landing page token URL → sheet row written → `MailApp` delivers short link to business owner.

Client clicks the short link → Apps Script `doGet` validates token and serves the landing page → client signs agreements, saves card on file, and uploads vaccination record → record stored in Google Drive.

On failure: MoeGo API failure triggers a full failure email with the customer ID and manual recovery steps. Short.io failure triggers a failure email with the full unshortened token URL for manual shortening. Sheet write failure triggers a failure email with the shortened URL so the owner can forward it manually.

---

## 3. Technical Stack

| Layer          | Technology                       | Notes                                                                                         |
| -------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| Runtime        | Node.js >= 20                    | LTS — stable for production                                                                   |
| Language       | TypeScript                       | Strict mode, NodeNext modules for Node.js/Vitest; compiled to CJS via esbuild for GAS runtime |
| Testing        | Vitest                           | ESM-native, compatible with TypeScript                                                        |
| Apps Script    | Google Apps Script via Clasp 3.x | Standalone web app, `doPost` entrypoint; esbuild handles TypeScript compilation               |
| Linting        | ESLint                           | Airbnb config                                                                                 |
| CI/CD          | GitHub Actions                   | See `.github/workflows/ci.yml`                                                                |
| URL Shortening | Short.io API                     | Free tier — 1,000 total links/year                                                            |

---

## 4. Project Scope

**In Scope**

- Receiving and validating `APPOINTMENT_CREATED` webhook events from MoeGo
- First-time client filtering — returning clients (identified by `lastAppointmentDate`) are skipped
- Retrieving Service Agreement sign link, SMS Agreement sign link, and card-on-file link per client via MoeGo API
- Generating and storing a per-client token with onboarding links and a 7-day TTL
- Shortening the token URL via Short.io API
- Writing the client row (name, phone, short link) to a Google Sheet
- Serving the per-client landing page via `doGet` with token validation
- Vaccination record upload to Google Drive via `uploadVaccinationRecord`
- Delivering the short link to the business owner via email
- Full failure, Short.io failure, and sheet write failure handling with manual recovery support

**Out of Scope**

- Direct delivery of the onboarding link to the client (owner forwards via SMS)
- Automated retry on API failure
- Support for URL shortening services other than Short.io
- Support for webhook events other than `APPOINTMENT_CREATED`
- Vaccination record parsing

**Constraints**

- Apps Script imposes a 6-minute execution limit — the flow must remain lightweight with no polling or retries
- MoeGo API key must be requested through a Customer Success Manager prior to development of any API-dependent phases
- Short.io account and API key must be created and configured by the business owner prior to deployment — see [Short.io Setup](short-io-setup.md)
- Google Sheet and Drive folder must be created and configured prior to deployment — see [Sheet & Drive Setup](sheet-setup.md)
- Google Apps Script does not expose incoming HTTP request headers in the DoPost event object. HMAC-SHA256 webhook signature verification is not possible in this runtime. Company ID filtering is the primary security control. A middleware layer for signature verification is tracked as a post-MVP enhancement — see Enhancements.

---

## 5. Modules & Responsibilities

**webhook/**
Receives and validates incoming MoeGo webhook payloads. Verifies event type is `APPOINTMENT_CREATED` and that the payload contains the expected customer data.

**moego/**
MoeGo API client. Handles authentication and retrieves the Service Agreement sign link, SMS Agreement sign link, and card-on-file link for a given customer.

**token/**
Generates per-client tokens (random UUID), stores them in PropertiesService with a 7-day TTL and onboarding link payload, and retrieves and validates them on request.

**shortener/**
Shortens the token URL via the Short.io API. `shortenUrl` falls back to the full URL on failure; `shortenUrlStrict` throws so callers can handle failure explicitly.

**sheet/**
Writes the client row (name, phone, short link) to the configured Google Sheet via `SpreadsheetApp`.

**email/**
Composes and delivers email to the business owner via `MailApp`. Handles success, full failure, Short.io failure, and sheet write failure cases.

**types/**
Shared TypeScript types and interfaces across modules.

**utils/**
Shared utility and helper functions.

**server.ts**
Apps Script `doPost` and `doGet` entrypoints. `doPost` orchestrates the full onboarding flow. `doGet` validates a token and serves the client landing page. `uploadVaccinationRecord` handles file uploads from the landing page to Google Drive.

---

## 6. Development Phases

### Phase 0 — Foundations

Repo scaffold: NodeNext TS, Vitest, ESLint Airbnb, Clasp setup, GitHub Actions CI, smoke test passing, git hooks (lint, test).

### Phase 1 — MoeGo Webhook

Implement webhook receiver and payload validation. TDD: valid payload, missing fields, wrong event type, malformed JSON.

### Phase 2 — MoeGo API Client

Implement authentication and API calls for Service Agreement sign link, SMS Agreement sign link, and card-on-file link. TDD: success cases, individual failure cases, auth failure, network error.

### Phase 3 — Form Builder

Implement pre-filled Google Form URL construction from customer data and links. TDD: all fields present, partial fields (each failure combination), empty/missing values.

### Phase 4 — URL Shortener

Implement Short.io API integration for URL shortening. TDD: successful shortening, Short.io API failure with full URL fallback.

### Phase 5 — Email Delivery

Implement success, partial failure, full failure, and Short.io fallback email composition and delivery via `MailApp`. TDD: all cases.

### Phase 6 — Integration & Apps Script Entrypoint

Implement `doPost`, wire all modules together, integration tests with mocked globals and stubbed API responses, end-to-end test with live MoeGo sandbox and real Google Form.

---

## 7. Testing Strategy

- Strict TDD throughout all phases — tests written before implementation
- Vitest for all TypeScript logic
- Clasp used for local Apps Script development and deployment
- Apps Script globals (`MailApp`, `UrlFetchApp`, etc.) mocked in Vitest for testability
- MoeGo API calls stubbed via mocked HTTP responses
- Short.io API calls stubbed via mocked HTTP responses
- Unit tests for each module: webhook validation, MoeGo API client, form builder, URL shortener, email delivery, and utils
- Integration tests for `doPost` entrypoint with mocked globals and stubbed API responses
- End-to-end test against live MoeGo sandbox and real Google Form in Phase 6

---

## 8. Configuration

All sensitive values are stored as environment variables and must never be committed to version control. Provide a `.env.example` file with placeholder values.

| Variable                     | Required | Description                                                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `MOEGO_API_KEY`              | Yes      | MoeGo API key — issued by Customer Success Manager                                                |
| `MOEGO_COMPANY_ID`           | Yes      | MoeGo company ID                                                                                  |
| `MOEGO_BUSINESS_ID`          | Yes      | MoeGo business ID                                                                                 |
| `MOEGO_SERVICE_AGREEMENT_ID` | Yes      | MoeGo Service Agreement ID                                                                        |
| `MOEGO_SMS_AGREEMENT_ID`     | Yes      | MoeGo SMS Agreement ID                                                                            |
| `MOEGO_WEBHOOK_SECRET`       | Yes      | MoeGo webhook secret for payload validation                                                       |
| `SHORTIO_API_KEY`            | Yes      | Short.io API access token — see [Short.io Setup](short-io-setup.md)                               |
| `SHORTIO_DOMAIN`             | Yes      | Short.io domain assigned to your account — see [Short.io Setup](short-io-setup.md)                |
| `BUSINESS_OWNER_EMAIL`       | Yes      | Comma-separated owner email addresses for onboarding notifications                                |
| `BUSINESS_NAME`              | Yes      | Business name displayed on the client landing page                                                |
| `BUSINESS_PHONE`             | Yes      | Business phone displayed on the landing page error screen                                         |
| `BUSINESS_LOGO_URL`          | Yes      | Public URL of the business logo image                                                             |
| `DRIVE_FOLDER_ID`            | Yes      | Google Drive folder ID for vaccination record uploads — see [Sheet & Drive Setup](sheet-setup.md) |
| `SPREADSHEET_ID`             | Yes      | Google Sheet spreadsheet ID for client row writes — see [Sheet & Drive Setup](sheet-setup.md)     |
| `LANDING_PAGE_URL`           | Yes      | Deployed GAS web app URL used to construct per-client token links                                 |

---

## 9. Development Conventions

- **Branching** — GitHub Flow; see `branching-strategy.md`
- **Commits** — Conventional Commits format; see `conventional-commits.md`
- **Code style** — ESLint + Prettier, Airbnb config; see `eslint-prettier.md`
- **Documentation** — JSDoc on all public interfaces; see `jsdoc-guidelines.md`

---

## 10. Risks & Mitigation

| Risk                                                                                                    | Likelihood | Impact | Mitigation                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MoeGo API availability — calls may fail due to downtime or rate limiting                                | Medium     | High   | Graceful failure handling and business owner notification with manual recovery path                                                                                          |
| MoeGo API key access — key must be requested through a Customer Success Manager                         | Low        | High   | Confirm access early in Phase 0 before any dependent development begins                                                                                                      |
| Short.io API availability — shortening call may fail                                                    | Low        | Low    | Fall back to full unshortened URL and notify business owner via email                                                                                                        |
| Short.io free tier limit — 1,000 short links per year                                                   | Low        | Low    | Monitor usage; old links can be deleted to stay within limit                                                                                                                 |
| Apps Script execution time limits — 6-minute execution limit                                            | Low        | High   | Keep the flow lightweight with no polling or retries                                                                                                                         |
| MoeGo webhook payload changes — payload structure may change without notice                             | Low        | Medium | Strict payload validation with clear error messaging                                                                                                                         |
| Google Apps Script global API changes — `MailApp` or `UrlFetchApp` interfaces may change                | Low        | Medium | Isolate Apps Script globals behind thin wrappers                                                                                                                             |
| Short.io data storage — pre-filled URL containing agreement and COF links is stored on Short.io servers | Low        | Low    | Links are not personally identifiable without accompanying customer data. Priority post-MVP enhancement replaces Short.io dependency entirely via doGet custom landing page. |

---

## 11. Open Questions

- [ ] Does MoeGo's API expose a send message endpoint? Confirm with Customer Success Manager before committing to an SMS delivery approach for the Automated SMS Delivery enhancement.

---

## 12. Deliverables

- Fully tested, documented TypeScript codebase
- Google Apps Script web app deployable via Clasp
- MoeGo webhook receiver with payload validation
- MoeGo API client for Service Agreement, SMS Agreement, and card-on-file link retrieval
- Google Form pre-filled URL builder
- Short.io URL shortener integration with full URL fallback
- Email delivery to business owner with success and failure handling
- GitHub Actions CI pipeline (lint, test, build)
