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

import { parseWebhookPayload } from '#/webhook/webhook.js';
import { getAgreementSignLink, getCofLink } from '#/moego/moego.js';
import { buildFormUrl } from '#/form/form.js';
import { shortenUrl } from '#/shortener/shortener.js';
import { sendSuccessEmail, sendPartialFailureEmail, sendFullFailureEmail } from '#/email/email.js';
import { getConfig } from '#/utils/config.js';

/**
 * Handle incoming HTTP POST requests from MoeGo webhooks.
 *
 * @function doPost
 * @description Entry point for the Apps Script web app. Receives the raw
 * webhook payload from MoeGo, parses and validates it, retrieves per-client
 * onboarding links from the MoeGo API, constructs a pre-filled Google Form
 * URL, shortens it via Short.io, and delivers the result to the business
 * owner via email.
 *
 * @param {GoogleAppsScript.Events.DoPost} e - The Apps Script POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} HTTP response.
 */
export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  // Parse and validate the incoming webhook payload
  const event = parseWebhookPayload(e.postData.contents);
  const { customer } = event;
  const config = getConfig();

  // Retrieve onboarding links from MoeGo API sequentially with individual
  // failure handling to support partial success email delivery.
  // TODO: Refactor to use UrlFetchApp.fetchAll for concurrent execution.
  let serviceAgreementUrl: string | null = null;
  let smsAgreementUrl: string | null = null;
  let cofUrl: string | null = null;

  try {
    serviceAgreementUrl = getAgreementSignLink({
      agreementId: config.moegoServiceAgreementId,
      customerId: customer.id,
      businessId: config.moegoBusinessId,
      apiKey: config.moegoApiKey,
    });
  } catch {
    // Service agreement link retrieval failed — proceed with null
  }

  try {
    smsAgreementUrl = getAgreementSignLink({
      agreementId: config.moegoSmsAgreementId,
      customerId: customer.id,
      businessId: config.moegoBusinessId,
      apiKey: config.moegoApiKey,
    });
  } catch {
    // SMS agreement link retrieval failed — proceed with null
  }

  try {
    cofUrl = getCofLink({
      customerId: customer.id,
      apiKey: config.moegoApiKey,
    });
  } catch {
    // Card-on-file link retrieval failed — proceed with null
  }

  // Build the pre-filled form URL with whatever links were retrieved
  const { url: formUrl, missingFields } = buildFormUrl({
    serviceAgreementUrl,
    smsAgreementUrl,
    cofUrl,
  });

  // All three API calls failed — send full failure email and return
  if (missingFields.length === 3) {
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: customer.id,
    });

    return ContentService.createTextOutput('OK');
  }

  // Shorten the form URL via Short.io
  const { url: shortUrl, shortened } = shortenUrl(formUrl);

  // One or more API calls failed — send partial failure email
  if (missingFields.length > 0) {
    sendPartialFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: customer.id,
      partialUrl: shortUrl,
      missingFields,
    });

    return ContentService.createTextOutput('OK');
  }

  // All API calls succeeded — send success email
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    url: shortUrl,
    shortened,
  });

  return ContentService.createTextOutput('OK');
}
