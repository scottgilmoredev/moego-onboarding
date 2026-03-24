/**
 * Email Module
 *
 * @module
 * @description Composes and delivers email to the business owner via GmailApp.
 * Handles success, partial failure, full failure, and Short.io fallback cases.
 */

import { getConfig } from '#/utils/config.js';

/**
 * Parameters for sending a success email.
 *
 * @interface SendSuccessEmailParams
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {string} url - The onboarding form URL, shortened or full.
 * @property {boolean} shortened - Whether the URL was successfully shortened.
 */
export interface SendSuccessEmailParams {
  firstName: string;
  lastName: string;
  url: string;
  shortened: boolean;
}

/**
 * Send a success email to the business owner.
 *
 * @function sendSuccessEmail
 * @description Composes and delivers an email to the business owner containing
 * the client's onboarding form URL for review and distribution via SMS. Includes
 * an advisory note if URL shortening failed.
 *
 * @param {SendSuccessEmailParams} params - The email parameters.
 * @returns {void}
 *
 * @example
 * sendSuccessEmail({
 *   firstName: customer.firstName,
 *   lastName: customer.lastName,
 *   url: shortenedUrl,
 *   shortened: true,
 * });
 */
export function sendSuccessEmail({
  firstName,
  lastName,
  url,
  shortened,
}: SendSuccessEmailParams): void {
  const config = getConfig();

  // Construct subject with first name and last initial
  const subject = `New Client Onboarding — ${firstName} ${lastName.charAt(0)}.`;

  // Build the fallback advisory note if URL shortening failed
  const fallbackNote = shortened
    ? ''
    : '\n\nNote: URL shortening failed. The link above is unshortened and may span multiple SMS segments if sent as-is. You may wish to shorten it manually before sending to the client.';

  // Compose the email body
  const body = `A new client has been created in MoeGo. Please send the following onboarding link to ${firstName} ${lastName.charAt(0)}. via SMS.\n\n${url}${fallbackNote}`;

  // Deliver the email via GmailApp
  GmailApp.sendEmail(config.businessOwnerEmail, subject, body);
}
