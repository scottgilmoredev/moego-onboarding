/**
 * URL Shortener
 *
 * @module
 * @description Shortens pre-filled Google Form URLs via the Short.io API.
 * Falls back to the full unshortened URL if the API call fails, surfacing
 * a flag for the email module to include an advisory note.
 */

import { getConfig } from '#/utils/config.js';

/**
 * Result of a URL shortening attempt.
 *
 * @interface ShortenUrlResult
 * @property {string} url - The shortened URL, or the full URL if shortening failed.
 * @property {boolean} shortened - Whether the URL was successfully shortened.
 */
export interface ShortenUrlResult {
  url: string;
  shortened: boolean;
}

/**
 * Shorten a URL via the Short.io API.
 *
 * @function shortenUrl
 * @description Attempts to shorten the provided URL via the Short.io API.
 * Returns the shortened URL on success. Falls back to the full unshortened
 * URL and sets shortened to false if the API call fails for any reason.
 *
 * @param {string} longUrl - The full URL to shorten.
 * @returns {Promise<ShortenUrlResult>} The shortened or fallback URL and success flag.
 *
 * @example
 * const { url, shortened } = await shortenUrl(formUrl);
 * if (!shortened) {
 *   // notify business owner that URL was not shortened
 * }
 */
export async function shortenUrl(longUrl: string): Promise<ShortenUrlResult> {
  const config = getConfig();

  try {
    // POST to Short.io API with the domain and original URL
    const response = UrlFetchApp.fetch('https://api.short.io/links', {
      method: 'post',
      headers: {
        authorization: config.shortIoApiKey,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        domain: config.shortIoDomain,
        originalURL: longUrl,
      }),
      muteHttpExceptions: true,
    });

    // Fall back to full URL if the response is not successful
    if (response.getResponseCode() !== 200) {
      return { url: longUrl, shortened: false };
    }

    // Parse and return the shortened URL
    const body = JSON.parse(response.getContentText()) as { shortURL: string };

    return { url: body.shortURL, shortened: true };
  } catch {
    // Fall back to full URL on network error or any unexpected failure
    return { url: longUrl, shortened: false };
  }
}
