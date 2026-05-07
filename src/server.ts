/**
 * Server
 *
 * @module
 * @description Apps Script doPost and doGet entrypoints. doPost receives
 * incoming MoeGo webhook requests and orchestrates the full client onboarding
 * flow: token generation, URL shortening, sheet row write, and owner notification.
 * doGet serves the per-client landing page by validating a token and rendering
 * the appropriate HTML template.
 *
 * @see {@link https://developers.google.com/apps-script/guides/web} Google Apps Script Web Apps
 */

import type { MoeGoAppointmentCreatedEvent, MoeGoCustomer } from './types/moego.js';

import { parseWebhookPayload } from '#/webhook/webhook.js';
import {
  getAgreementSignLink,
  getCofLink,
  getCustomer,
  hasFinishedAppointments,
} from '#/moego/moego.js';
import { generateToken, getToken, storeToken } from '#/token/token.js';
import { shortenUrlStrict } from '#/shortener/shortener.js';
import {
  updateClientOnboardingLink,
  writeClientRow,
  writeVaccinationRecord,
} from '#/sheet/sheet.js';
import {
  sendSuccessEmail,
  sendFullFailureEmail,
  sendShortIoFailureEmail,
  sendSheetWriteFailureEmail,
  sendUploadNotificationEmail,
} from '#/email/email.js';
import { getConfig } from '#/utils/config.js';
import { SUPPORTED_EVENT_TYPES } from '#/utils/constants.js';
import { logger } from '#/utils/logger.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * The onboarding links retrieved from the MoeGo API.
 *
 * @interface OnboardingLinks
 * @property {string | null} serviceAgreementUrl - The Service Agreement sign link, or null if retrieval failed.
 * @property {string | null} smsAgreementUrl - The SMS Agreement sign link, or null if retrieval failed.
 * @property {string | null} cofUrl - The card-on-file link, or null if retrieval failed.
 */
interface OnboardingLinks {
  serviceAgreementUrl: string | null;
  smsAgreementUrl: string | null;
  cofUrl: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Fetch all per-client onboarding links from the MoeGo API.
 *
 * @function fetchOnboardingLinks
 * @description Attempts to retrieve the Service Agreement sign link, SMS
 * Agreement sign link, and card-on-file link for the given customer. Each
 * call is wrapped individually to support partial success — if one fails,
 * the others proceed. Failed calls return null.
 *
 * @param {object} params - The request parameters.
 * @param {string} params.customerId - The MoeGo customer ID.
 * @param {string} params.businessId - The MoeGo business ID.
 * @param {string} params.serviceAgreementId - The Service Agreement ID.
 * @param {string} params.smsAgreementId - The SMS Agreement ID.
 * @param {string} params.apiKey - The MoeGo API key.
 * @returns {OnboardingLinks} The retrieved links, with null for any that failed.
 */
export function fetchOnboardingLinks({
  customerId,
  businessId,
  serviceAgreementId,
  smsAgreementId,
  apiKey,
}: {
  customerId: string;
  businessId: string;
  serviceAgreementId: string;
  smsAgreementId: string;
  apiKey: string;
}): OnboardingLinks {
  let serviceAgreementUrl: string | null = null;
  let smsAgreementUrl: string | null = null;
  let cofUrl: string | null = null;

  // Get the Service Agreement sign link
  try {
    serviceAgreementUrl = getAgreementSignLink({
      agreementId: serviceAgreementId,
      customerId,
      businessId,
      apiKey,
    });
  } catch (err) {
    logger.error('fetchOnboardingLinks', 'serviceAgreementUrl failed', {
      customerId,
      error: String(err),
    });
  }

  // Get the SMS Agreement sign link
  try {
    smsAgreementUrl = getAgreementSignLink({
      agreementId: smsAgreementId,
      customerId,
      businessId,
      apiKey,
    });
  } catch (err) {
    logger.error('fetchOnboardingLinks', 'smsAgreementUrl failed', {
      customerId,
      error: String(err),
    });
  }

  // Get the card-on-file link
  try {
    cofUrl = getCofLink({ customerId, apiKey });
  } catch (err) {
    logger.error('fetchOnboardingLinks', 'cofUrl failed', { customerId, error: String(err) });
  }

  return { serviceAgreementUrl, smsAgreementUrl, cofUrl };
}

/**
 * Fetch a customer from the MoeGo API, returning null on failure.
 *
 * @function fetchCustomer
 * @description Wraps getCustomer() with error handling. Returns null if the
 * API call fails, allowing doPost to handle the failure case without a
 * try/catch in the main flow.
 *
 * @param {string} customerId - The MoeGo customer ID.
 * @param {string} apiKey - The MoeGo API key.
 * @returns {MoeGoCustomer | null} The customer, or null if retrieval failed.
 */
export function fetchCustomer(customerId: string, apiKey: string): MoeGoCustomer | null {
  try {
    return getCustomer({ customerId, apiKey });
  } catch (err) {
    logger.error('fetchCustomer', 'customer fetch failed', { customerId, error: String(err) });
    return null;
  }
}

/**
 * Upload a vaccination record file to Google Drive.
 *
 * @function uploadVaccinationRecord
 * @description Called via google.script.run from the client landing page.
 * Resolves the client name from the token payload to prefix the filename, then
 * decodes the base64-encoded file, validates its magic bytes against the claimed
 * MIME type, and creates it in the configured Drive folder. Invalidates the token
 * after a successful upload. Falls back to the original filename if the token
 * cannot be resolved.
 *
 * @param {string} fileName - The original file name.
 * @param {string} mimeType - The MIME type of the file.
 * @param {string} dataBase64 - The base64-encoded file contents.
 * @param {string} token - The client's landing page token.
 */
export function uploadVaccinationRecord(
  fileName: string,
  mimeType: string,
  dataBase64: string,
  token: string
): void {
  const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
  const normalizedMimeType = mimeType.toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(normalizedMimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    logger.warn('uploadVaccinationRecord', 'rejected — disallowed MIME type', {
      mimeType: normalizedMimeType,
    });
    throw new Error('Invalid file type');
  }

  const bytes = Utilities.base64Decode(dataBase64);
  const signatures: Record<string, number[]> = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };
  const sig = signatures[normalizedMimeType];
  // GAS Utilities.base64Decode returns signed bytes; mask to unsigned before comparing.
  const hasValidSignature = sig.every((byte, i) => (bytes[i] & 0xff) === byte);

  if (!hasValidSignature) {
    logger.warn('uploadVaccinationRecord', 'rejected — magic byte mismatch', {
      mimeType: normalizedMimeType,
    });
    throw new Error('Invalid file type');
  }

  const { driveFolderId } = getConfig();
  const payload = getToken(token);

  // Rename file to LastName_FirstName_vaccination.ext if token resolves
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const resolvedFileName = payload
    ? `${payload.lastName}_${payload.firstName}_vaccination${ext}`
    : fileName;

  // Enforce upload cap
  const uploadCount = payload?.uploadCount ?? 0;

  if (uploadCount >= 5) {
    logger.warn('uploadVaccinationRecord', 'rejected — upload cap reached', {
      customerId: payload?.customerId,
      uploadCount,
    });
    throw new Error('Upload limit reached');
  }

  const folder = DriveApp.getFolderById(driveFolderId);
  const blob = Utilities.newBlob(bytes, normalizedMimeType, resolvedFileName);

  const file = folder.createFile(blob);

  // Increment upload count and append file metadata (including Drive URL) for
  // client-side row persistence and batch notification retrieval.
  if (payload) {
    const fileUrl = file.getUrl();
    const uploads = [
      ...(payload.uploads ?? []),
      { name: fileName, size: bytes.length, type: normalizedMimeType, fileUrl },
    ];

    PropertiesService.getScriptProperties().setProperty(
      token,
      JSON.stringify({ ...payload, uploadCount: uploadCount + 1, uploads })
    );

    writeVaccinationRecord({
      customerId: payload.customerId,
      fileUrl,
    });

    logger.info('uploadVaccinationRecord', 'file uploaded', {
      customerId: payload.customerId,
      mimeType: normalizedMimeType,
      uploadCount: uploadCount + 1,
    });
  }
}

/**
 * Send a single batch upload notification email to the business owner.
 *
 * @function sendBatchUploadNotification
 * @description Called by the client after the full upload queue completes.
 * Reads all Drive file URLs stored in the token payload and sends one email
 * listing them all, avoiding per-file inbox spam.
 *
 * @param {string} token - The client's landing page token.
 * @returns {void}
 */
export function sendBatchUploadNotification(token: string): void {
  const payload = getToken(token);

  if (!payload) {
    logger.warn('sendBatchUploadNotification', 'token not found — notification skipped');
    return;
  }

  const fileUrls = (payload.uploads ?? [])
    .map((u: { fileUrl?: string }) => u.fileUrl)
    .filter((url: string | undefined): url is string => Boolean(url));

  if (fileUrls.length === 0) {
    logger.warn('sendBatchUploadNotification', 'no file URLs in payload — notification skipped', {
      customerId: payload.customerId,
    });
    return;
  }

  sendUploadNotificationEmail({
    firstName: payload.firstName,
    lastName: payload.lastName,
    fileUrls,
  });

  logger.info('sendBatchUploadNotification', 'batch notification sent', {
    customerId: payload.customerId,
    fileCount: fileUrls.length,
  });
}

// ============================================================================
// OWNER TOOLS
// ============================================================================

/**
 * Re-trigger the onboarding flow for a given customer.
 *
 * @function retriggerOnboarding
 * @description Owner-invocable function for reissuing an onboarding link to a
 * client whose token has expired or who was skipped on the initial webhook. Fetches
 * the customer and onboarding links, generates a new token, shortens the URL, and
 * updates the existing sheet row or inserts a new one if none exists. Sends the same
 * success email as the initial flow on completion. Called from the GAS editor by
 * wrapping it in a zero-argument function with the customerId hardcoded.
 *
 * @param {string} customerId - The MoeGo customer ID to re-trigger onboarding for.
 * @returns {void}
 */
export function retriggerOnboarding(customerId: string): void {
  const {
    moegoApiKey,
    moegoBusinessId,
    moegoServiceAgreementId,
    moegoSmsAgreementId,
    landingPageUrl,
  } = getConfig();

  logger.info('retriggerOnboarding', 'triggered', { customerId });

  const customer = fetchCustomer(customerId, moegoApiKey);

  if (!customer) {
    sendFullFailureEmail({ firstName: 'Unknown', lastName: 'Unknown', customerId });
    return;
  }

  logger.info('retriggerOnboarding', 'customer fetched', { customerId });

  const { serviceAgreementUrl, smsAgreementUrl, cofUrl } = fetchOnboardingLinks({
    customerId,
    businessId: moegoBusinessId,
    serviceAgreementId: moegoServiceAgreementId,
    smsAgreementId: moegoSmsAgreementId,
    apiKey: moegoApiKey,
  });

  if (!serviceAgreementUrl || !smsAgreementUrl || !cofUrl) {
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId,
    });
    return;
  }

  logger.info('retriggerOnboarding', 'onboarding links fetched', { customerId });

  const token = generateToken();

  storeToken(token, {
    customerId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    serviceAgreementUrl,
    smsAgreementUrl,
    cofUrl,
  });

  logger.info('retriggerOnboarding', 'token generated and stored', { customerId });

  const fullUrl = `${landingPageUrl}?token=${token}`;

  let shortUrl: string;

  try {
    shortUrl = shortenUrlStrict(fullUrl);
  } catch (err) {
    logger.error('retriggerOnboarding', 'shortenUrlStrict failed', {
      customerId,
      error: String(err),
    });

    sendShortIoFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId,
      fullUrl,
    });

    return;
  }

  logger.info('retriggerOnboarding', 'URL shortened', { customerId });

  try {
    const updated = updateClientOnboardingLink({ customerId, shortUrl });

    if (!updated) {
      writeClientRow({ customer, shortUrl });
    }
  } catch (err) {
    logger.error('retriggerOnboarding', 'sheet write failed', { customerId, error: String(err) });

    sendSheetWriteFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId,
      shortUrl,
    });

    return;
  }

  logger.info('retriggerOnboarding', 'sheet row written', { customerId });

  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    shortUrl,
  });

  logger.info('retriggerOnboarding', 'success email sent', { customerId });
}

// ============================================================================
// ENTRYPOINTS
// ============================================================================

/**
 * Handle incoming HTTP POST requests from MoeGo webhooks.
 *
 * @function doPost
 * @description Entry point for the Apps Script web app. Receives the raw
 * webhook payload from MoeGo, parses and validates it, skips returning clients,
 * fetches the customer and per-client onboarding links, generates a token,
 * shortens the landing page URL, writes the sheet row, and notifies the owner.
 *
 * @param {GoogleAppsScript.Events.DoPost} e - The Apps Script POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} HTTP response.
 */
export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const event = parseWebhookPayload(e.postData.contents) as MoeGoAppointmentCreatedEvent;
  const {
    moegoApiKey,
    moegoBusinessId,
    moegoCompanyId,
    moegoServiceAgreementId,
    moegoSmsAgreementId,
    landingPageUrl,
  } = getConfig();

  // Ignore events for other companies
  if (event.companyId !== moegoCompanyId) {
    logger.warn('doPost', 'company ID mismatch — ignored', { companyId: event.companyId });
    return ContentService.createTextOutput('OK');
  }

  // Ignore unsupported event types
  const isSupportedEvent = SUPPORTED_EVENT_TYPES.includes(
    event.type as (typeof SUPPORTED_EVENT_TYPES)[number]
  );

  if (!isSupportedEvent) {
    logger.warn('doPost', 'unsupported event type — ignored', { eventType: event.type });
    return ContentService.createTextOutput('OK');
  }

  const { appointment } = event;

  logger.info('doPost', 'webhook received', {
    eventType: event.type,
    appointmentId: appointment.id,
    customerId: appointment.customerId,
  });

  // Retrieve customer details — required to check onboarding status and for email delivery
  const customer = fetchCustomer(appointment.customerId, moegoApiKey);

  // Customer lookup failed — send full failure email with manual recovery steps
  if (!customer) {
    sendFullFailureEmail({
      firstName: 'Unknown',
      lastName: 'Unknown',
      customerId: appointment.customerId,
    });

    return ContentService.createTextOutput('OK');
  }

  logger.info('doPost', 'customer fetched', { customerId: appointment.customerId });

  // Skip returning clients — any finished appointment confirms prior onboarding
  let returningClient: boolean;

  try {
    returningClient = hasFinishedAppointments({
      customerId: appointment.customerId,
      companyId: moegoCompanyId,
      businessId: moegoBusinessId,
      apiKey: moegoApiKey,
    });
  } catch (err) {
    logger.error('doPost', 'hasFinishedAppointments failed', {
      customerId: appointment.customerId,
      error: String(err),
    });

    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
    });

    return ContentService.createTextOutput('OK');
  }

  if (returningClient) {
    logger.warn('doPost', 'returning client skipped', { customerId: appointment.customerId });
    return ContentService.createTextOutput('OK');
  }

  // Retrieve onboarding links — all three must succeed to generate a token
  const { serviceAgreementUrl, smsAgreementUrl, cofUrl } = fetchOnboardingLinks({
    customerId: appointment.customerId,
    businessId: moegoBusinessId,
    serviceAgreementId: moegoServiceAgreementId,
    smsAgreementId: moegoSmsAgreementId,
    apiKey: moegoApiKey,
  });

  // Any link failure — send full failure email and abort
  if (!serviceAgreementUrl || !smsAgreementUrl || !cofUrl) {
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
    });

    return ContentService.createTextOutput('OK');
  }

  logger.info('doPost', 'onboarding links fetched', { customerId: appointment.customerId });

  // Generate and store a token with the client's onboarding links
  const token = generateToken();

  storeToken(token, {
    customerId: appointment.customerId,
    firstName: customer.firstName,
    lastName: customer.lastName,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    serviceAgreementUrl,
    smsAgreementUrl,
    cofUrl,
  });

  logger.info('doPost', 'token generated and stored', { customerId: appointment.customerId });

  // Build the full landing page URL for this client
  const fullUrl = `${landingPageUrl}?token=${token}`;

  // Shorten the landing page URL — failure triggers Short.io failure email
  let shortUrl: string;

  try {
    shortUrl = shortenUrlStrict(fullUrl);
  } catch (err) {
    logger.error('doPost', 'shortenUrlStrict failed', {
      customerId: appointment.customerId,
      error: String(err),
    });

    sendShortIoFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
      fullUrl,
    });

    return ContentService.createTextOutput('OK');
  }

  logger.info('doPost', 'URL shortened', { customerId: appointment.customerId });

  // Write the sheet row — failure triggers sheet write failure email
  try {
    writeClientRow({ customer, shortUrl });
  } catch (err) {
    logger.error('doPost', 'writeClientRow failed', {
      customerId: appointment.customerId,
      error: String(err),
    });

    sendSheetWriteFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
      shortUrl,
    });

    return ContentService.createTextOutput('OK');
  }

  logger.info('doPost', 'sheet row written', { customerId: appointment.customerId });

  // All steps succeeded — notify the owner
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    shortUrl,
  });

  logger.info('doPost', 'success email sent', { customerId: appointment.customerId });

  return ContentService.createTextOutput('OK');
}

/**
 * Handle incoming HTTP GET requests for the client landing page.
 *
 * @function doGet
 * @description Entry point for the Apps Script web app. Extracts the token
 * from the request URL, validates it, and serves the landing page or an error
 * page depending on whether the token is valid and unexpired.
 *
 * @param {GoogleAppsScript.Events.DoGet} e - The Apps Script GET event object.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} HTML response.
 */
export function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  const { businessName, businessLogoUrl, businessPhone } = getConfig();

  // Extract token from query parameters and validate it
  const token = e.parameter.token as string | undefined;
  const payload = token ? getToken(token) : null;

  // Missing, invalid, or expired token — render error page
  if (!payload) {
    logger.warn('doGet', 'invalid or expired token', { token: token ?? 'missing' });
    const errorTemplate = HtmlService.createTemplateFromFile('error');
    const errorVars = errorTemplate as unknown as Record<string, unknown>;

    errorVars.businessName = businessName;
    errorVars.businessLogoUrl = businessLogoUrl;
    errorVars.businessPhone = businessPhone;

    return errorTemplate.evaluate();
  }

  logger.info('doGet', 'landing page served', { customerId: payload.customerId });

  // Valid token — pass payload and business config to template and render landing page
  const landingTemplate = HtmlService.createTemplateFromFile('landing');
  const landingVars = landingTemplate as unknown as Record<string, unknown>;

  landingVars.token = token;
  landingVars.payload = payload;
  landingVars.businessName = businessName;
  landingVars.businessLogoUrl = businessLogoUrl;
  landingVars.businessPhone = businessPhone;

  return landingTemplate.evaluate();
}

// Expose entrypoints as globals for the GAS runtime
(globalThis as unknown as Record<string, unknown>).doPost = doPost;
(globalThis as unknown as Record<string, unknown>).doGet = doGet;
(globalThis as unknown as Record<string, unknown>).uploadVaccinationRecord =
  uploadVaccinationRecord;
(globalThis as unknown as Record<string, unknown>).retriggerOnboarding = retriggerOnboarding;
