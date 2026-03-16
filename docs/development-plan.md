# Development Plan — moego-onboarding

## 1. Project Overview

**Goal:**
Enable a MoeGo-based pet service business owner to automatically receive a pre-filled client onboarding form URL via email whenever a new client is created in MoeGo, eliminating the need to manually generate and send individual onboarding links.

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

MoeGo fires `CUSTOMER_CREATED` webhook → Apps Script `doPost` receives and validates payload → MoeGo API calls retrieve Service Agreement sign link, SMS Agreement sign link, and card-on-file link → Form builder constructs pre-filled Google Form URL → Bitly shortens the URL → `GmailApp` delivers email to business owner.

On failure: any failed API call results in an email to the business owner containing the partial pre-filled URL, details of the failure(s), and the customer's MoeGo ID for manual recovery. If Bitly shortening fails, the full unshortened URL is delivered with a note that the URL may span multiple SMS segments if sent as-is.

---

## 3. Technical Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js >= 20 | LTS — stable for production |
| Language | TypeScript | Strict mode, NodeNext modules |
| Testing | Vitest | ESM-native, compatible with TypeScript |
| Apps Script | Google Apps Script via Clasp | Standalone web app, `doPost` entrypoint |
| Linting | ESLint | Airbnb config |
| CI/CD | GitHub Actions | See `.github/workflows/ci.yml` |
| URL Shortening | Bitly API | Free tier — 1,000 short links/month |

---

## 4. Project Scope

**In Scope**
- Receiving and validating `CUSTOMER_CREATED` webhook events from MoeGo
- Retrieving Service Agreement sign link, SMS Agreement sign link, and card-on-file link per client via MoeGo API
- Constructing a pre-filled Google Form URL from customer data and retrieved links
- Shortening the pre-filled URL via Bitly API
- Delivering the onboarding form URL to the business owner via email
- Partial and full failure handling with manual recovery support
- Bitly failure fallback — deliver full unshortened URL with advisory note

**Out of Scope**
- Google Form creation and configuration
- Direct delivery of the onboarding form URL to the client
- Automated retry on API failure
- Support for URL shortening services other than Bitly
- Support for webhook events other than `CUSTOMER_CREATED`
- Vaccination record parsing
- Any user interface beyond the email delivered to the business owner

**Constraints**
- Apps Script imposes a 6-minute execution limit — the flow must remain lightweight with no polling or retries
- MoeGo API key must be requested through a Customer Success Manager prior to development of any API-dependent phases
- The Google Form must be created and configured prior to deployment — field entry IDs must be identified and set in configuration before the app can construct pre-filled URLs — see [Form Setup](form-setup.md)
- Bitly account and API key must be created and configured by the business owner prior to deployment — see [Bitly Setup](bitly-setup.md)

---

## 5. Modules & Responsibilities

**webhook/**
Receives and validates incoming MoeGo webhook payloads. Verifies event type is `CUSTOMER_CREATED` and that the payload contains the expected customer data.

**moego/**
MoeGo API client. Handles authentication and retrieves the Service Agreement sign link, SMS Agreement sign link, and card-on-file link for a given customer.

**form/**
Constructs the pre-filled Google Form URL from customer data and retrieved links.

**shortener/**
Shortens the pre-filled Google Form URL via the Bitly API. Falls back to the full URL if shortening fails.

**email/**
Composes and delivers email to the business owner via `GmailApp`. Handles success, partial failure, full failure, and Bitly fallback cases.

**types/**
Shared TypeScript types and interfaces across modules.

**utils/**
Shared utility and helper functions.

**server.ts**
Apps Script `doPost` entrypoint. Orchestrates the full onboarding flow by delegating to the above modules.

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
Implement Bitly API integration for URL shortening. TDD: successful shortening, Bitly API failure with full URL fallback.

### Phase 5 — Email Delivery
Implement success, partial failure, full failure, and Bitly fallback email composition and delivery via `GmailApp`. TDD: all cases.

### Phase 6 — Integration & Apps Script Entrypoint
Implement `doPost`, wire all modules together, integration tests with mocked globals and stubbed API responses, end-to-end test with live MoeGo sandbox and real Google Form.

---

## 7. Testing Strategy

- Strict TDD throughout all phases — tests written before implementation
- Vitest for all TypeScript logic
- Clasp used for local Apps Script development and deployment
- Apps Script globals (`GmailApp`, `UrlFetchApp`, etc.) mocked in Vitest for testability
- MoeGo API calls stubbed via mocked HTTP responses
- Bitly API calls stubbed via mocked HTTP responses
- Unit tests for each module: webhook validation, MoeGo API client, form builder, URL shortener, email delivery, and utils
- Integration tests for `doPost` entrypoint with mocked globals and stubbed API responses
- End-to-end test against live MoeGo sandbox and real Google Form in Phase 6

---

## 8. Configuration

All sensitive values are stored as environment variables and must never be committed to version control. Provide a `.env.example` file with placeholder values.

| Variable | Required | Description |
|---|---|---|
| `MOEGO_API_KEY` | Yes | MoeGo API key — issued by Customer Success Manager |
| `MOEGO_COMPANY_ID` | Yes | MoeGo company ID |
| `MOEGO_BUSINESS_ID` | Yes | MoeGo business ID |
| `MOEGO_SERVICE_AGREEMENT_ID` | Yes | MoeGo Service Agreement ID |
| `MOEGO_SMS_AGREEMENT_ID` | Yes | MoeGo SMS Agreement ID |
| `BITLY_API_KEY` | Yes | Bitly API access token — see [Bitly Setup](bitly-setup.md) |
| `BUSINESS_OWNER_EMAIL` | Yes | Recipient email address for onboarding notifications |
| `GOOGLE_FORM_URL` | Yes | Base URL of the onboarding Google Form — see [Form Setup](form-setup.md) |
| `FORM_ENTRY_FIRST_NAME` | Yes | Google Form entry ID for first name field |
| `FORM_ENTRY_LAST_NAME` | Yes | Google Form entry ID for last name field |
| `FORM_ENTRY_PHONE` | Yes | Google Form entry ID for phone number field |
| `FORM_ENTRY_SERVICE_AGREEMENT` | Yes | Google Form entry ID for Service Agreement link field |
| `FORM_ENTRY_SMS_AGREEMENT` | Yes | Google Form entry ID for SMS Agreement link field |
| `FORM_ENTRY_COF` | Yes | Google Form entry ID for card-on-file link field |

---

## 9. Development Conventions

- **Branching** — GitHub Flow; see `branching-strategy.md`
- **Commits** — Conventional Commits format; see `conventional-commits.md`
- **Code style** — ESLint + Prettier, Airbnb config; see `eslint-prettier.md`
- **Documentation** — JSDoc on all public interfaces; see `jsdoc-guidelines.md`

---

## 10. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MoeGo API availability — calls may fail due to downtime or rate limiting | Medium | High | Graceful failure handling and business owner notification with manual recovery path |
| MoeGo API key access — key must be requested through a Customer Success Manager | Low | High | Confirm access early in Phase 0 before any dependent development begins |
| Bitly API availability — shortening call may fail | Low | Low | Fall back to full unshortened URL and notify business owner via email |
| Bitly free tier limit — 1,000 short links per month | Low | Medium | Monitor usage; upgrade Bitly plan if volume approaches limit |
| Apps Script execution time limits — 6-minute execution limit | Low | High | Keep the flow lightweight with no polling or retries |
| MoeGo webhook payload changes — payload structure may change without notice | Low | Medium | Strict payload validation with clear error messaging |
| Google Apps Script global API changes — `GmailApp` or `UrlFetchApp` interfaces may change | Low | Medium | Isolate Apps Script globals behind thin wrappers |

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
- Bitly URL shortener integration with full URL fallback
- Email delivery to business owner with success and failure handling
- GitHub Actions CI pipeline (lint, test, build)
