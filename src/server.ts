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

/**
 * Handle incoming HTTP POST requests from MoeGo webhooks.
 *
 * @function doPost
 * @description Entry point for the Apps Script web app. Receives the raw
 * webhook payload from MoeGo, parses and validates it, then orchestrates
 * the onboarding flow.
 *
 * @param {GoogleAppsScript.Events.DoPost} e - The Apps Script POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} HTTP response.
 */
export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  // Parse and validate the incoming webhook payload
  const event = parseWebhookPayload(e.postData.contents);

  // TODO: Milestone 6 — wire remaining modules
  // eslint-disable-next-line no-console
  console.log('Received CUSTOMER_CREATED event for customer:', event.customer.id);

  return ContentService.createTextOutput('OK');
}
