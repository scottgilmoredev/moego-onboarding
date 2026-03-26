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

import { parseWebhookPayload, verifyWebhookSignature } from '#/webhook/webhook.js';
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
  Logger.log('doPost: received webhook request');

  const event = parseWebhookPayload(e.postData.contents);
  const { customer } = event;
  const config = getConfig();

  Logger.log(`doPost: event type = ${event.type}, customer id = ${customer.id}`);

  if (event.companyId !== config.moegoCompanyId) {
    Logger.log(`doPost: ignoring event for company ${event.companyId}`);
    return ContentService.createTextOutput('OK');
  }

  const isValid = verifyWebhookSignature({
    body: e.postData.contents,
    clientId: e.parameter['X-Moe-Client-Id'],
    nonce: e.parameter['X-Moe-Nonce'],
    timestamp: e.parameter['X-Moe-Timestamp'],
    signature: e.parameter['X-Moe-Signature-256'],
    secret: config.moegoWebhookSecret,
  });

  Logger.log(`doPost: signature verification = ${isValid}`);

  if (!isValid) {
    return ContentService.createTextOutput('Forbidden').setMimeType(ContentService.MimeType.TEXT);
  }

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
    Logger.log(`doPost: serviceAgreementUrl retrieved`);
  } catch (err) {
    Logger.log(`doPost: serviceAgreementUrl failed — ${String(err)}`);
  }

  try {
    smsAgreementUrl = getAgreementSignLink({
      agreementId: config.moegoSmsAgreementId,
      customerId: customer.id,
      businessId: config.moegoBusinessId,
      apiKey: config.moegoApiKey,
    });
    Logger.log(`doPost: smsAgreementUrl retrieved`);
  } catch (err) {
    Logger.log(`doPost: smsAgreementUrl failed — ${String(err)}`);
  }

  try {
    cofUrl = getCofLink({
      customerId: customer.id,
      apiKey: config.moegoApiKey,
    });
    Logger.log(`doPost: cofUrl retrieved`);
  } catch (err) {
    Logger.log(`doPost: cofUrl failed — ${String(err)}`);
  }

  const { url: formUrl, missingFields } = buildFormUrl({
    serviceAgreementUrl,
    smsAgreementUrl,
    cofUrl,
  });

  Logger.log(`doPost: missingFields = ${JSON.stringify(missingFields)}`);

  if (missingFields.length === 3) {
    Logger.log(`doPost: sending full failure email`);
    sendFullFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: customer.id,
    });
    return ContentService.createTextOutput('OK');
  }

  const { url: shortUrl, shortened } = shortenUrl(formUrl);
  Logger.log(`doPost: url shortened = ${shortened}`);

  if (missingFields.length > 0) {
    Logger.log(`doPost: sending partial failure email`);
    sendPartialFailureEmail({
      firstName: customer.firstName,
      lastName: customer.lastName,
      customerId: customer.id,
      partialUrl: shortUrl,
      missingFields,
    });
    return ContentService.createTextOutput('OK');
  }

  Logger.log(`doPost: sending success email`);
  sendSuccessEmail({
    firstName: customer.firstName,
    lastName: customer.lastName,
    url: shortUrl,
    shortened,
  });

  return ContentService.createTextOutput('OK');
}

// Expose doPost as a global for the GAS runtime
(globalThis as unknown as Record<string, unknown>).doPost = doPost;
