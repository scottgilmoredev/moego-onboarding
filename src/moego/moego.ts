/**
 * MoeGo API Client
 *
 * @module
 * @description Handles authentication and communication with the MoeGo REST API.
 * Retrieves per-client Service Agreement sign link, SMS Agreement sign link,
 * and card-on-file link.
 */

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
  return `Basic ${btoa(apiKey)}`;
}
