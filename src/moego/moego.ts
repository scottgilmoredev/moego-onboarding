/**
 * MoeGo API Client
 *
 * @module
 * @description Handles authentication and communication with the MoeGo REST API.
 * Retrieves per-client agreement sign links and card-on-file link. Agreement
 * sign link retrieval handles both Service Agreement and SMS Agreement via
 * {@link getAgreementSignLink}.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base URL for the MoeGo API.
 *
 * @constant {string}
 */
const MOEGO_BASE_URL = 'https://openapi.moego.pet';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Parameters for making a request to the MoeGo API.
 *
 * @interface FetchFromMoeGoParams
 * @property {string} path - The API endpoint path (e.g. '/v1/agreements/{id}/sign_link').
 * @property {Record<string, string>} [params] - Optional query parameters.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface FetchFromMoeGoParams {
  path: string;
  params?: Record<string, string>;
  apiKey: string;
}

/**
 * Parameters for retrieving an agreement sign link.
 *
 * @interface GetAgreementSignLinkParams
 * @property {string} agreementId - The MoeGo agreement ID. Use
 * `config.moegoServiceAgreementId` for the Service Agreement or
 * `config.moegoSmsAgreementId` for the SMS Agreement.
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} businessId - The MoeGo business ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface GetAgreementSignLinkParams {
  agreementId: string;
  customerId: string;
  businessId: string;
  apiKey: string;
}

/**
 * Parameters for retrieving a card-on-file link.
 *
 * @interface GetCofLinkParams
 * @property {string} customerId - The MoeGo customer ID.
 * @property {string} apiKey - The MoeGo API key.
 */
export interface GetCofLinkParams {
  customerId: string;
  apiKey: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Build the Authorization header for MoeGo API requests.
 *
 * @function buildAuthHeader
 * @description Constructs a Basic auth header by Base64-encoding the API key
 * per the MoeGo API authentication specification.
 *
 * @param {string} apiKey - The MoeGo API key secret.
 * @returns {string} The formatted Authorization header value.
 *
 * @example
 * const authHeader = buildAuthHeader(config.moegoApiKey);
 * // Returns: "Basic <base64-encoded-key>"
 */
export function buildAuthHeader(apiKey: string): string {
  // Base64-encode the API key and prepend the Basic auth scheme
  return `Basic ${apiKey}`;
}

/**
 * Make an authenticated GET request to the MoeGo API.
 *
 * @function fetchFromMoeGo
 * @description Constructs and executes an authenticated GET request to the
 * MoeGo API. Handles query parameter construction, authentication headers,
 * response code validation, and JSON parsing.
 *
 * @template T - The expected response body type.
 * @param {FetchFromMoeGoParams} params - The request parameters.
 * @returns {T} The parsed response body.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * const result = fetchFromMoeGo<{ signUrl: string }>({
 *   path: '/v1/agreements/agr_001/sign_link',
 *   params: { customer_id: 'cus_001', business_id: 'biz_001' },
 *   apiKey: config.moegoApiKey,
 * });
 */
export function fetchFromMoeGo<T>({ path, params, apiKey }: FetchFromMoeGoParams): T {
  // Construct query string from params if provided
  const queryString = params
    ? `?${Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')}`
    : '';

  // Construct the full URL
  const url = `${MOEGO_BASE_URL}${path}${queryString}`;

  // Execute the authenticated request via UrlFetchApp
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: buildAuthHeader(apiKey),
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });

  // Throw a clear error if the response is not successful
  const responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    throw new Error(
      `MoeGo API error: GET ${path} returned ${responseCode} — ${response.getContentText()}`
    );
  }

  // Parse and return the response body
  return JSON.parse(response.getContentText()) as T;
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Retrieve an agreement sign link for a given customer.
 *
 * @function getAgreementSignLink
 * @description Calls the MoeGo Agreement API to generate a unique signing URL
 * for the specified agreement and customer.
 *
 * @param {GetAgreementSignLinkParams} params - The request parameters.
 * @returns {string} The unique signing URL.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * // Retrieve Service Agreement sign link
 * const serviceAgreementUrl = getAgreementSignLink({
 *   agreementId: config.moegoServiceAgreementId,
 *   customerId: customer.id,
 *   businessId: config.moegoBusinessId,
 *   apiKey: config.moegoApiKey,
 * });
 *
 * // Retrieve SMS Agreement sign link
 * const smsAgreementUrl = getAgreementSignLink({
 *   agreementId: config.moegoSmsAgreementId,
 *   customerId: customer.id,
 *   businessId: config.moegoBusinessId,
 *   apiKey: config.moegoApiKey,
 * });
 */
export function getAgreementSignLink({
  agreementId,
  customerId,
  businessId,
  apiKey,
}: GetAgreementSignLinkParams): string {
  // Retrieve the agreement sign link via the MoeGo API
  const result = fetchFromMoeGo<{ signUrl: string }>({
    path: `/v1/agreements/${agreementId}/sign_link`,
    params: { customer_id: customerId, business_id: businessId },
    apiKey,
  });

  return result.signUrl;
}

/**
 * Retrieve a card-on-file link for a given customer.
 *
 * @function getCofLink
 * @description Calls the MoeGo Customer API to generate a unique card-on-file
 * link for the specified customer.
 *
 * @param {GetCofLinkParams} params - The request parameters.
 * @returns {string} The unique card-on-file link.
 * @throws {Error} If the API returns a non-200 response.
 * @throws {Error} If the API call fails due to a network error.
 *
 * @example
 * const cofLink = getCofLink({
 *   customerId: customer.id,
 *   apiKey: config.moegoApiKey,
 * });
 */
export function getCofLink({ customerId, apiKey }: GetCofLinkParams): string {
  // Retrieve the card-on-file link via the MoeGo Customer API
  const result = fetchFromMoeGo<{ link: string }>({
    path: `/v1/customers/${customerId}/cof/link`,
    apiKey,
  });

  return result.link;
}
