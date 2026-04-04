/* eslint-disable no-console */

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
import { writeClientRow } from '#/sheet/sheet.js';
import {
  sendSuccessEmail,
  sendFullFailureEmail,
  sendShortIoFailureEmail,
  sendSheetWriteFailureEmail,
} from '#/email/email.js';
import { getConfig } from '#/utils/config.js';
import { SUPPORTED_EVENT_TYPES } from '#/utils/constants.js';

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
    console.log(`fetchOnboardingLinks: serviceAgreementUrl failed — ${String(err)}`);
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
    console.log(`fetchOnboardingLinks: smsAgreementUrl failed — ${String(err)}`);
  }

  // Get the card-on-file link
  try {
    cofUrl = getCofLink({ customerId, apiKey });
  } catch (err) {
    console.log(`fetchOnboardingLinks: cofUrl failed — ${String(err)}`);
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
    console.log(`fetchCustomer: failed — ${String(err)}`);
    return null;
  }
}

/**
 * Upload a vaccination record file to Google Drive.
 *
 * @function uploadVaccinationRecord
 * @description Called via google.script.run from the client landing page.
 * Decodes the base64-encoded file and creates it in the configured Drive folder.
 *
 * @param {string} fileName - The original file name.
 * @param {string} mimeType - The MIME type of the file.
 * @param {string} dataBase64 - The base64-encoded file contents.
 */
export function uploadVaccinationRecord(
  fileName: string,
  mimeType: string,
  dataBase64: string
): void {
  const { driveFolderId } = getConfig();
  const folder = DriveApp.getFolderById(driveFolderId);
  const bytes = Utilities.base64Decode(dataBase64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  folder.createFile(blob);
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
    return ContentService.createTextOutput('OK');
  }

  // Ignore unsupported event types
  const isSupportedEvent = SUPPORTED_EVENT_TYPES.includes(
    event.type as (typeof SUPPORTED_EVENT_TYPES)[number]
  );

  if (!isSupportedEvent) {
    return ContentService.createTextOutput('OK');
  }

  const { appointment } = event;

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
    console.log(`doPost: hasFinishedAppointments failed — ${String(err)}`);

    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
    });

    return ContentService.createTextOutput('OK');
  }

  if (returningClient) {
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

  // Build the full landing page URL for this client
  const fullUrl = `${landingPageUrl}?token=${token}`;

  // Shorten the landing page URL — failure triggers Short.io failure email
  let shortUrl: string;

  try {
    shortUrl = shortenUrlStrict(fullUrl);
  } catch (err) {
    console.log(`doPost: shortenUrlStrict failed — ${String(err)}`);

    sendShortIoFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
      fullUrl,
    });

    return ContentService.createTextOutput('OK');
  }

  // Write the sheet row — failure triggers sheet write failure email
  try {
    writeClientRow({ customer, shortUrl });
  } catch (err) {
    console.log(`doPost: writeClientRow failed — ${String(err)}`);

    sendSheetWriteFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: appointment.customerId,
      shortUrl,
    });

    return ContentService.createTextOutput('OK');
  }

  // All steps succeeded — notify the owner
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    shortUrl,
  });

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
    const errorTemplate = HtmlService.createTemplateFromFile('error');
    const errorVars = errorTemplate as unknown as Record<string, unknown>;

    errorVars.businessName = businessName;
    errorVars.businessLogoUrl = businessLogoUrl;
    errorVars.businessPhone = businessPhone;

    return errorTemplate.evaluate();
  }

  // Valid token — pass payload and business config to template and render landing page
  const landingTemplate = HtmlService.createTemplateFromFile('landing');
  const landingVars = landingTemplate as unknown as Record<string, unknown>;

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
