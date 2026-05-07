/**
 * Logger Module Tests
 *
 * @module
 * @description Unit tests for the centralized logging service. Covers severity
 * routing, structured JSON output shape, context field spreading, and isolation
 * between log levels.
 */

import { logger } from './logger.js';

/**
 * output shape
 *
 * @description Tests that each log method emits valid, parseable JSON
 * containing the required fields.
 */
describe('output shape', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * @test
   * @description Confirms logger.info emits a valid JSON string.
   */
  it('logger.info emits valid JSON', () => {
    logger.info('mod', 'msg');

    const raw = infoSpy.mock.calls[0][0] as string;

    expect(() => JSON.parse(raw)).not.toThrow();
  });

  /**
   * @test
   * @description Confirms logger.warn emits a valid JSON string.
   */
  it('logger.warn emits valid JSON', () => {
    logger.warn('mod', 'msg');

    const raw = warnSpy.mock.calls[0][0] as string;

    expect(() => JSON.parse(raw)).not.toThrow();
  });

  /**
   * @test
   * @description Confirms logger.error emits a valid JSON string.
   */
  it('logger.error emits valid JSON', () => {
    logger.error('mod', 'msg');

    const raw = errorSpy.mock.calls[0][0] as string;

    expect(() => JSON.parse(raw)).not.toThrow();
  });

  /**
   * @test
   * @description Confirms output contains module and message fields.
   */
  it('output contains module and message fields', () => {
    logger.info('testModule', 'testMessage');

    const entry = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(entry.module).toBe('testModule');
    expect(entry.message).toBe('testMessage');
  });

  /**
   * @test
   * @description Confirms output without context contains only module and message.
   */
  it('output without context contains only module and message', () => {
    logger.info('mod', 'msg');

    const entry = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(Object.keys(entry)).toEqual(['module', 'message']);
  });

  /**
   * @test
   * @description Confirms context fields are spread at the top level of the entry.
   */
  it('context fields are spread at top level', () => {
    logger.info('mod', 'msg', { customerId: 'cus_123', appointmentId: 'apt_456' });

    const entry = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(entry.customerId).toBe('cus_123');
    expect(entry.appointmentId).toBe('apt_456');
    expect(entry.context).toBeUndefined();
  });

  /**
   * @test
   * @description Confirms module and message are not overwritten by context key collisions.
   */
  it('context does not overwrite module or message', () => {
    logger.info('mod', 'msg', { module: 'override', message: 'override' });

    const entry = JSON.parse(infoSpy.mock.calls[0][0] as string);

    expect(entry.module).toBe('mod');
    expect(entry.message).toBe('msg');
  });
});

/**
 * logger.info
 *
 * @description Tests that logger.info routes to console.info only.
 */
describe('logger.info', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * @test
   * @description Confirms logger.info calls console.info.
   */
  it('calls console.info', () => {
    logger.info('mod', 'msg');

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * @test
   * @description Confirms logger.info does not call console.warn or console.error.
   */
  it('does not call console.warn or console.error', () => {
    logger.info('mod', 'msg');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

/**
 * logger.warn
 *
 * @description Tests that logger.warn routes to console.warn only.
 */
describe('logger.warn', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * @test
   * @description Confirms logger.warn calls console.warn.
   */
  it('calls console.warn', () => {
    logger.warn('mod', 'msg');

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * @test
   * @description Confirms logger.warn does not call console.info or console.error.
   */
  it('does not call console.info or console.error', () => {
    logger.warn('mod', 'msg');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

/**
 * logger.error
 *
 * @description Tests that logger.error routes to console.error only.
 */
describe('logger.error', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * @test
   * @description Confirms logger.error calls console.error.
   */
  it('calls console.error', () => {
    logger.error('mod', 'msg');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * @test
   * @description Confirms logger.error does not call console.info or console.warn.
   */
  it('does not call console.info or console.warn', () => {
    logger.error('mod', 'msg');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
