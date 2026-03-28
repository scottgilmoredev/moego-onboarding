# Enhancements — moego-onboarding

This document captures planned and potential post-MVP enhancements. Items here are not yet scoped into milestones. See [Milestones](milestones.md) for the current development plan.

---

**Custom Client Landing Page (Priority Enhancement)**

Replace the shared Google Form approach with a per-client landing page served by the Apps Script `doGet` entrypoint. Each client receives a unique token-based URL that renders a private page containing only their specific onboarding links. The token contains no sensitive data, eliminating the current concern around agreement and COF links being stored by Short.io.

Dependencies: token generation and storage via PropertiesService, `doGet` HTML rendering, token expiry/invalidation logic.

---

**Automated Clasp Deployment via CI**

The current deployment process requires manual execution of clasp push and clasp deploy from a local machine. Automating this via GitHub Actions would deploy the Apps Script web app automatically when changes are merged to main.

This requires service account authentication for Clasp in a non-interactive CI environment — see gas-clasp-setup.md for context. A service account with the appropriate Google APIs enabled would need to be configured and its credentials stored as GitHub Actions secrets.

---

**Automated SMS Delivery to Client**

Rather than emailing the business owner for review and manual distribution, deliver the pre-filled onboarding form URL directly to the client via SMS upon receiving the `APPOINTMENT_CREATED` webhook event.

MoeGo's API does not appear to expose a messaging endpoint. A third-party SMS provider such as Twilio would likely be required. MoeGo API messaging capabilities should be confirmed before committing to an implementation approach.

_Note: URL shortening for SMS delivery is already handled in the current implementation via the Short.io integration._

---

**Additional Webhook Events**

Beyond `APPOINTMENT_CREATED`, other MoeGo webhook events could be used to trigger additional automated flows. For example, `APPOINTMENT_CREATED` could be used to trigger a welcome communication when a new client is added, and `CUSTOMER_UPDATED` could be used to detect changes to client data that require follow-up.

The full list of supported events is defined in the MoeGo Event API and should be reviewed when scoping this enhancement.

---

**Alternative Client Delivery Methods**

The current delivery method sends the pre-filled onboarding form URL to the business owner via email for review and manual distribution to the client. Alternative delivery methods for getting the form URL directly to the client could include:

- Email directly to the client (requires client email address, which is optional in MoeGo's customer data model)
- SMS via MoeGo or a third-party provider (see Automated SMS Delivery to Client)
- A custom client-facing landing page that renders the onboarding links without requiring a Google Form

---

**Automated Failure Recovery**

On API failure, the business owner receives an email with the partial pre-filled URL, failure details, and the customer's MoeGo ID for manual recovery. This enhancement would automate the recovery process by implementing a retry mechanism for failed API calls, and re-triggering delivery once all links are successfully retrieved — eliminating the need for manual intervention.

Dependencies: retry strategy and backoff logic, and a mechanism for re-triggering the onboarding flow for a specific customer outside of the webhook event.

---

**Alternative URL Shortener Services**

The MVP supports Short.io for URL shortening. Supporting additional services would require a common shortener interface with multiple implementations. Alternative services worth considering:

**TinyURL**
TinyURL Free tier includes 100 links/month and 600 API requests/month (based on reviews). Simpler setup than Short.io.
https://tinyurl.com/app/dev

**Dub**
Open source, generous free tier, modern developer-focused API.
https://dub.co/docs

**Bitly**
Free tier limited to 5 links/month — insufficient for regular onboarding volume. Paid plans start at $10/month (billed annually) with 100 links/month.
https://dev.bitly.com

---

**Multi-Business Owner Support**

The current implementation is scoped to a single business owner with a fixed Google Form and configuration. Scaling to multiple business owners would require:

- Per-owner configuration (MoeGo credentials, Google Form URL, field entry IDs, Short.io API key, recipient email)
- A mechanism for routing incoming webhooks to the correct owner's configuration
- Per-owner Google Forms, as each owner's form URL and field entry IDs will differ

A form builder component that programmatically creates and configures the Google Form for each owner via the Google Forms API would be a natural companion to this enhancement, eliminating the need for manual form creation and configuration per owner. The Google Forms API supports programmatic form creation and is worth evaluating when scoping this enhancement.

https://developers.google.com/forms/api/reference/rest

---

**Vaccination Record Parsing**

Clients are required to upload rabies vaccination paperwork as part of the onboarding process. This enhancement would programmatically extract the vaccination date from uploaded documents, eliminating the need for manual review.

The appropriate approach depends on the variety and quality of documents submitted by clients, as well as cost and infrastructure preferences.

**Options:**

**Google Cloud Vision API**
OCR-based text extraction with date parsing applied to the extracted text. Free tier: 1,000 units/month. Well-suited given existing Google ecosystem usage.
https://cloud.google.com/vision

**Google Document AI**
Google's dedicated document parsing service, more sophisticated than Vision API for structured document analysis. Free tier available.
https://cloud.google.com/document-ai

**AWS Textract**
Amazon's OCR and document analysis service. Pay-per-use, no free tier beyond the AWS free trial period.
https://aws.amazon.com/textract

**Azure AI Document Intelligence**
Microsoft's document analysis service. Pay-per-use with a free tier.
https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence

**OpenAI GPT-4 Vision**
Send the document image with a prompt to extract the vaccination date. Flexible for varied document formats. Pay-per-use.
https://platform.openai.com/docs/guides/vision

**Anthropic Claude API**
Similar to GPT-4 Vision — document image analysis via prompt. Flexible for inconsistent document formats. Pay-per-use.
https://docs.anthropic.com/en/docs/build-with-claude/vision

**Tesseract**
Open source OCR library, self-hosted. No per-use cost but requires more implementation work and infrastructure management.
https://github.com/tesseract-ocr/tesseract

**Middleware Layer for Webhook Signature Verification**

Google Apps Script does not expose incoming HTTP request headers in the DoPost event object, making HMAC-SHA256 webhook signature verification impossible in the current runtime. A middleware layer — such as a lightweight Express server or cloud function — positioned in front of the Apps Script web app would receive the raw webhook request, verify the X-Moe-Signature-256 header, and forward validated requests to the Apps Script endpoint. This would restore signature verification as a security control without requiring a runtime change.
