/**
 * Token Module Tests
 *
 * @module
 * @description Unit tests for per-client token generation. Covers return type,
 * URL-safety, and uniqueness.
 */

import { generateToken } from './token.js';

/**
 * generateToken
 *
 * @description Tests for per-client token generation. Covers return type,
 * URL-safety, and uniqueness.
 */
describe('generateToken', () => {
  beforeEach(() => {
    vi.stubGlobal('Utilities', {
      getUuid: vi.fn().mockReturnValue('550e8400-e29b-41d4-a716-446655440000'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms generateToken returns a string.
   */
  it('returns a string', () => {
    expect(typeof generateToken()).toBe('string');
  });

  /**
   * @test
   * @description Confirms the token contains no characters requiring URL encoding.
   */
  it('returns a URL-safe token', () => {
    const token = generateToken();
    expect(encodeURIComponent(token)).toBe(token);
  });

  /**
   * @test
   * @description Confirms each call produces a unique token.
   */
  it('returns a unique token on each call', () => {
    vi.stubGlobal('Utilities', {
      getUuid: vi
        .fn()
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440000')
        .mockReturnValueOnce('660e8400-e29b-41d4-a716-446655440001'),
    });
    expect(generateToken()).not.toBe(generateToken());
  });
});
