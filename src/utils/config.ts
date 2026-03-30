/**
 * Configuration Module
 *
 * @module
 * @description Abstracts environment variable access across Node.js and GAS
 * runtime environments. Reads from process.env in Node.js and PropertiesService
 * in GAS runtime. Throws a clear error if any required variable is missing.
 */

import { IS_GAS_RUNTIME } from '#/utils/constants.js';

/**
 * Application configuration values.
 *
 * @interface Config
 * @property {string} moegoApiKey - MoeGo API key — issued by Customer Success Manager.
 * @property {string} moegoCompanyId - MoeGo company ID.
 * @property {string} moegoBusinessId - MoeGo business ID.
 * @property {string} moegoServiceAgreementId - MoeGo Service Agreement ID.
 * @property {string} moegoSmsAgreementId - MoeGo SMS Agreement ID.
 * @property {string} shortIoApiKey - Short.io API key.
 * @property {string[]} businessOwnerEmails - Recipient email addresses for onboarding notifications.
 * @property {string} googleFormUrl - Base URL of the onboarding Google Form.
 * @property {string} formEntryServiceAgreement - Google Form entry ID for Service Agreement link field.
 * @property {string} formEntrySmsAgreement - Google Form entry ID for SMS Agreement link field.
 * @property {string} formEntryCof - Google Form entry ID for card-on-file link field.
 * @property {string} shortIoDomain - Short.io domain for link shortening.
 * @property {string} moegoWebhookSecret - MoeGo webhook secret token.
 * @property {string} businessName - The business name shown on the landing page.
 * @property {string} businessLogoUrl - URL of the circular business logo shown on the landing page.
 * @property {string} businessPhone - The business phone number shown on the landing page.
 * @property {string} driveFolderId - Google Drive folder ID for storing onboarding documents.
 * @property {string} spreadsheetId - Google Sheet ID for appending onboarding rows.
 */
export interface Config {
  moegoApiKey: string;
  moegoCompanyId: string;
  moegoBusinessId: string;
  moegoServiceAgreementId: string;
  moegoSmsAgreementId: string;
  shortIoApiKey: string;
  businessOwnerEmails: string[];
  googleFormUrl: string;
  formEntryServiceAgreement: string;
  formEntrySmsAgreement: string;
  formEntryCof: string;
  shortIoDomain: string;
  moegoWebhookSecret: string;
  businessName: string;
  businessLogoUrl: string;
  businessPhone: string;
  driveFolderId: string;
  spreadsheetId: string;
}

/**
 * Retrieve a configuration value by key.
 *
 * @function getEnvValue
 * @description Reads a value from process.env in Node.js or PropertiesService
 * in GAS runtime. Throws if the value is missing or empty.
 *
 * @param {string} key - The environment variable key.
 * @returns {string} The configuration value.
 * @throws {Error} If the value is missing or empty.
 * @private
 */
function getEnvValue(key: string): string {
  // Read from PropertiesService in GAS runtime, process.env in Node.js
  const value = IS_GAS_RUNTIME
    ? PropertiesService.getScriptProperties().getProperty(key)
    : process.env[key];

  // Throw a clear error if the value is missing or empty
  if (!value) {
    throw new Error(`Missing required environment variable: "${key}"`);
  }

  return value;
}

/**
 * Get the application configuration.
 *
 * @function getConfig
 * @description Reads and validates all required environment variables,
 * returning a typed Config object. Throws if any required variable is missing.
 *
 * @returns {Config} The application configuration.
 * @throws {Error} If any required environment variable is missing.
 *
 * @example
 * const config = getConfig();
 * const apiKey = config.moegoApiKey;
 */
export function getConfig(): Config {
  return {
    moegoApiKey: getEnvValue('MOEGO_API_KEY'),
    moegoCompanyId: getEnvValue('MOEGO_COMPANY_ID'),
    moegoBusinessId: getEnvValue('MOEGO_BUSINESS_ID'),
    moegoServiceAgreementId: getEnvValue('MOEGO_SERVICE_AGREEMENT_ID'),
    moegoSmsAgreementId: getEnvValue('MOEGO_SMS_AGREEMENT_ID'),
    shortIoApiKey: getEnvValue('SHORTIO_API_KEY'),
    googleFormUrl: getEnvValue('GOOGLE_FORM_URL'),
    formEntryServiceAgreement: getEnvValue('FORM_ENTRY_SERVICE_AGREEMENT'),
    formEntrySmsAgreement: getEnvValue('FORM_ENTRY_SMS_AGREEMENT'),
    formEntryCof: getEnvValue('FORM_ENTRY_COF'),
    shortIoDomain: getEnvValue('SHORTIO_DOMAIN'),
    moegoWebhookSecret: getEnvValue('MOEGO_WEBHOOK_SECRET'),
    businessName: getEnvValue('BUSINESS_NAME'),
    businessLogoUrl: getEnvValue('BUSINESS_LOGO_URL'),
    businessPhone: getEnvValue('BUSINESS_PHONE'),
    driveFolderId: getEnvValue('DRIVE_FOLDER_ID'),
    spreadsheetId: getEnvValue('SPREADSHEET_ID'),

    // Parse comma-separated email list into an array
    businessOwnerEmails: getEnvValue('BUSINESS_OWNER_EMAILS')
      .split(',')
      .map(e => e.trim()),
  };
}
