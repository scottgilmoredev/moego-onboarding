# Enhancements — moego-onboarding

This document captures planned and potential post-MVP enhancements. Items here are not yet scoped into milestones. See [Milestones](milestones.md) for the current development plan.

---

**Vaccination Record Parsing (Owner Request)**

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

The current delivery method sends the onboarding link to the business owner via email for review and manual distribution to the client. Alternative delivery methods for getting the link directly to the client could include:

- Email directly to the client (requires client email address, which is optional in MoeGo's customer data model)
- SMS via MoeGo or a third-party provider (see Automated SMS Delivery to Client)

---

**Automated Failure Recovery**

On API failure, the business owner receives an email with failure details and can manually re-trigger the onboarding flow using `retriggerOnboarding` from the GAS editor (see [retrigger-guide.md](retrigger-guide.md)). This enhancement would automate the recovery process by implementing a retry mechanism for failed API calls, re-triggering delivery once all links are successfully retrieved without requiring manual intervention.

Dependencies: retry strategy and backoff logic.

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

The current implementation is scoped to a single business owner. Scaling to multiple business owners would require:

- A separate GAS deployment per owner, each running under the owner's own Google account — a shared deployment is not appropriate, as `MailApp` always sends from the deploying account with no override, and the broad `drive` OAuth scope would grant a single deploying account access to all owners' Drive storage
- Per-owner Script Properties (MoeGo credentials, Short.io API key, Drive folder ID, spreadsheet ID, landing page URL, business branding)
- A mechanism for routing incoming webhooks to the correct owner's deployment

A deployment automation tool that provisions a new GAS project, configures Script Properties, and sets up the Sheet and Drive folder for each new owner would significantly reduce manual setup overhead at scale. Having the script provision its own Drive folder on first run would also allow switching from the broad `drive` scope to the narrower `drive.file` scope, restricting Drive access to only files and folders the script itself creates.

**Note:** GAS is appropriate for single-owner use but its constraints compound quickly at scale — the script always runs as the deploying account, OAuth scopes are coarse, there is no per-user auth, and there is no header access for webhook verification. A proper backend (e.g. Cloud Run, Lambda) with per-owner OAuth is the recommended path for multi-owner expansion rather than working around GAS limitations.

---

**Middleware Layer for Webhook Signature Verification**

Google Apps Script does not expose incoming HTTP request headers in the DoPost event object, making HMAC-SHA256 webhook signature verification impossible in the current runtime. A middleware layer — such as a lightweight Express server or cloud function — positioned in front of the Apps Script web app would receive the raw webhook request, verify the X-Moe-Signature-256 header, and forward validated requests to the Apps Script endpoint. This would restore signature verification as a security control without requiring a runtime change.
