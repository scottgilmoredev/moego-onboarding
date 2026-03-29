/* eslint-disable no-console */

/**
 * Server
 *
 * @module
 * @description Apps Script doPost entrypoint. Receives incoming MoeGo webhook
 * requests and orchestrates the full client onboarding flow by delegating to
 * the webhook, MoeGo API client, form URL builder, URL shortener, and email
 * delivery modules.
 *
 * @see {@link https://developers.google.com/apps-script/guides/web} Google Apps Script Web Apps
 */

import type { MoeGoAppointmentCreatedEvent, MoeGoCustomer } from './types/moego.js';

import { parseWebhookPayload } from '#/webhook/webhook.js';
import { getAgreementSignLink, getCofLink, getCustomer } from '#/moego/moego.js';
import { buildFormUrl } from '#/form/form.js';
import { shortenUrl } from '#/shortener/shortener.js';
import { sendSuccessEmail, sendPartialFailureEmail, sendFullFailureEmail } from '#/email/email.js';
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
 * Build the onboarding form URL and dispatch the appropriate email.
 *
 * @function sendOnboardingEmail
 * @description Constructs the pre-filled Google Form URL from the retrieved
 * onboarding links, shortens it via Short.io, and sends the appropriate
 * email based on how many links were successfully retrieved.
 *
 * @param {object} params - The request parameters.
 * @param {MoeGoCustomer} params.customer - The customer details.
 * @param {string} params.customerId - The MoeGo customer ID.
 * @param {OnboardingLinks} params.links - The retrieved onboarding links.
 */
export function sendOnboardingEmail({
  customer,
  customerId,
  links,
}: {
  customer: MoeGoCustomer;
  customerId: string;
  links: OnboardingLinks;
}): void {
  const { url: formUrl, missingFields } = buildFormUrl(links);

  // All three API calls failed — send full failure email with manual recovery steps
  if (missingFields.length === 3) {
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId,
    });

    return;
  }

  // Shorten the form URL via Short.io — falls back to full URL on failure
  const { url: shortUrl, shortened } = shortenUrl(formUrl);

  // One or more API calls failed — send partial failure email with the partial URL
  if (missingFields.length > 0) {
    sendPartialFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId,
      partialUrl: shortUrl,
      missingFields,
    });

    return;
  }

  // All API calls succeeded — send success email with the full onboarding link
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    url: shortUrl,
    shortened,
  });
}

/**
 * Handle incoming HTTP POST requests from MoeGo webhooks.
 *
 * @function doPost
 * @description Entry point for the Apps Script web app. Receives the raw
 * webhook payload from MoeGo, parses and validates it, fetches the customer
 * and per-client onboarding links from the MoeGo API, and dispatches the
 * appropriate email to the business owner.
 *
 * @param {GoogleAppsScript.Events.DoPost} e - The Apps Script POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} HTTP response.
 */
export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  // Parse and validate the incoming webhook payload
  const event = parseWebhookPayload(e.postData.contents) as MoeGoAppointmentCreatedEvent;
  const {
    moegoApiKey,
    moegoBusinessId,
    moegoCompanyId,
    moegoServiceAgreementId,
    moegoSmsAgreementId,
  } = getConfig();

  // Ignore events for other companies (in case company scoping fails or the webhook secret is compromised)
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

  // Retrieve customer details — required for email delivery and identification
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

  // Retrieve onboarding links from MoeGo API
  const { serviceAgreementUrl, smsAgreementUrl, cofUrl } = fetchOnboardingLinks({
    customerId: appointment.customerId,
    businessId: moegoBusinessId,
    serviceAgreementId: moegoServiceAgreementId,
    smsAgreementId: moegoSmsAgreementId,
    apiKey: moegoApiKey,
  });

  sendOnboardingEmail({
    customer,
    customerId: appointment.customerId,
    links: { serviceAgreementUrl, smsAgreementUrl, cofUrl },
  });

  return ContentService.createTextOutput('OK');
}

// Expose doPost as a global for the GAS runtime
(globalThis as unknown as Record<string, unknown>).doPost = doPost;
