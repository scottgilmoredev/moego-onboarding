/**
 * Token Module
 *
 * @module
 * @description Generates, stores, retrieves, and expires per-client tokens
 * for use in onboarding landing page URLs.
 */

/**
 * Token payload stored per client in ScriptProperties.
 *
 * @interface TokenPayload
 * @property {string} customerId - The client's MoeGo customer ID.
 * @property {string} firstName - The client's first name.
 * @property {string} lastName - The client's last name.
 * @property {number} expiresAt - Unix timestamp (ms) after which the token is invalid.
 * @property {string} serviceAgreementUrl - The client's MoeGo service agreement sign link.
 * @property {string} smsAgreementUrl - The client's MoeGo SMS agreement sign link.
 * @property {string} cofUrl - The client's MoeGo card-on-file link.
 */
export interface TokenPayload {
  customerId: string;
  firstName: string;
  lastName: string;
  expiresAt: number;
  serviceAgreementUrl: string;
  smsAgreementUrl: string;
  cofUrl: string;
}

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

/**
 * Purge expired tokens from ScriptProperties.
 *
 * @function purgeExpiredTokens
 * @description Iterates all ScriptProperties entries and deletes any that can
 * be parsed as a TokenPayload with an expired expiresAt timestamp. Entries that
 * cannot be parsed are skipped.
 *
 * @returns {void}
 */
export function purgeExpiredTokens(): void {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();

  for (const [key, value] of Object.entries(all)) {
    try {
      const payload = JSON.parse(value) as TokenPayload;

      if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
        props.deleteProperty(key);
      }
    } catch {
      // not a token entry — skip
    }
  }
}

/**
 * Store a token and its payload in ScriptProperties.
 *
 * @function storeToken
 * @description Purges expired tokens, then serializes the token payload and
 * stores it in ScriptProperties keyed by the token value.
 *
 * @param {string} token - The token to use as the storage key.
 * @param {TokenPayload} payload - The payload to store.
 * @returns {void}
 */
export function storeToken(token: string, payload: TokenPayload): void {
  purgeExpiredTokens();
  PropertiesService.getScriptProperties().setProperty(token, JSON.stringify(payload));
}

/**
 * Retrieve a token payload from ScriptProperties.
 *
 * @function getToken
 * @description Retrieves and deserializes the token payload from ScriptProperties.
 * Returns null if the token is missing or expired. Deletes expired tokens on access.
 *
 * @param {string} token - The token to look up.
 * @returns {TokenPayload | null} The payload if valid and unexpired, otherwise null.
 */
export function getToken(token: string): TokenPayload | null {
  const raw = PropertiesService.getScriptProperties().getProperty(token);

  if (!raw) return null;

  const payload = JSON.parse(raw) as TokenPayload;

  if (Date.now() > payload.expiresAt) {
    PropertiesService.getScriptProperties().deleteProperty(token);
    return null;
  }

  return payload;
}
