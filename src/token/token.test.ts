/**
 * Token Module Tests
 *
 * @module
 * @description Unit tests for per-client token generation, storage, retrieval,
 * and expiry. Covers return type, URL-safety, uniqueness, serialization,
 * expiry handling, and missing token handling.
 */

import { generateToken, storeToken, getToken, purgeExpiredTokens } from './token.js';
import type { TokenPayload } from './token.js';

const basePayload: TokenPayload = {
  customerId: 'cus_001',
  firstName: 'Jane',
  lastName: 'Smith',
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  serviceAgreementUrl: 'https://example.com/service-agreement',
  smsAgreementUrl: 'https://example.com/sms-agreement',
  cofUrl: 'https://example.com/cof',
};

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

/**
 * storeToken
 *
 * @description Tests for token storage. Covers serialization and persistence
 * to ScriptProperties.
 */
describe('storeToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms the token payload is serialized and stored in ScriptProperties.
   */
  it('stores the serialized payload in ScriptProperties', () => {
    const mockSetProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({}),
        setProperty: mockSetProperty,
        getProperty: vi.fn(),
        deleteProperty: vi.fn(),
      }),
    });

    storeToken('test-token', basePayload);

    expect(mockSetProperty).toHaveBeenCalledWith('test-token', JSON.stringify(basePayload));
  });
});

/**
 * purgeExpiredTokens
 *
 * @description Tests for expired token purging. Covers expired entry deletion,
 * unexpired entry retention, non-token entry skipping, and no-op on empty properties.
 */
describe('purgeExpiredTokens', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms expired token entries are deleted from ScriptProperties.
   */
  it('deletes expired token entries', () => {
    const expiredPayload: TokenPayload = { ...basePayload, expiresAt: Date.now() - 1 };
    const deleteProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({
          'expired-token': JSON.stringify(expiredPayload),
        }),
        deleteProperty,
      }),
    });

    purgeExpiredTokens();

    expect(deleteProperty).toHaveBeenCalledWith('expired-token');
  });

  /**
   * @test
   * @description Confirms unexpired token entries are not deleted.
   */
  it('skips unexpired token entries', () => {
    const deleteProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({
          'valid-token': JSON.stringify(basePayload),
        }),
        deleteProperty,
      }),
    });

    purgeExpiredTokens();

    expect(deleteProperty).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms entries that cannot be parsed as a TokenPayload are skipped.
   */
  it('skips non-token entries', () => {
    const deleteProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({
          'some-other-key': 'not-json',
        }),
        deleteProperty,
      }),
    });

    purgeExpiredTokens();

    expect(deleteProperty).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms no deletions occur when ScriptProperties is empty.
   */
  it('no-ops when ScriptProperties is empty', () => {
    const deleteProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({}),
        deleteProperty,
      }),
    });

    purgeExpiredTokens();

    expect(deleteProperty).not.toHaveBeenCalled();
  });
});

/**
 * getToken
 *
 * @description Tests for token retrieval. Covers valid unexpired tokens,
 * expired tokens, and missing tokens.
 */
describe('getToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms a valid, unexpired token returns the correct payload.
   */
  it('returns the payload for a valid unexpired token', () => {
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(basePayload)),
        deleteProperty: vi.fn(),
      }),
    });

    expect(getToken('test-token')).toEqual(basePayload);
  });

  /**
   * @test
   * @description Confirms an expired token returns null and is deleted from ScriptProperties.
   */
  it('returns null and deletes an expired token', () => {
    const expiredPayload = { ...basePayload, expiresAt: Date.now() - 1 };
    const deleteProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(expiredPayload)),
        deleteProperty,
      }),
    });

    expect(getToken('test-token')).toBeNull();
    expect(deleteProperty).toHaveBeenCalledWith('test-token');
  });

  /**
   * @test
   * @description Confirms a missing token returns null.
   */
  it('returns null for a missing token', () => {
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(null),
        deleteProperty: vi.fn(),
      }),
    });

    expect(getToken('test-token')).toBeNull();
  });
});
