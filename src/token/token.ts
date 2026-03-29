/**
 * Token Module
 *
 * @module
 * @description Generates per-client tokens for use in onboarding landing page URLs.
 */

/**
 * Generate a unique, URL-safe token.
 *
 * @function generateToken
 * @description Generates a UUID v4 token via Utilities.getUuid(). The result
 * is URL-safe and suitable for use as a PropertiesService key and URL query parameter.
 *
 * @returns {string} A URL-safe UUID v4 token.
 *
 * @example
 * const token = generateToken();
 */
export function generateToken(): string {
  return Utilities.getUuid();
}
