/**
 * Google Sheets Client Tests
 *
 * @module
 * @description Unit tests for the Google Sheets client. Covers successful
 * row append, SpreadsheetApp errors, and sheet-not-found errors.
 */

import { appendSheetRow } from './sheet.js';

const mockConfig = {
  spreadsheetId: 'test-spreadsheet-id',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

/**
 * appendSheetRow
 *
 * @description Tests for the appendSheetRow function. Covers successful
 * append, SpreadsheetApp errors, and sheet-not-found errors.
 */
describe('appendSheetRow', () => {
  const mockSheet = { appendRow: vi.fn() };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  beforeEach(() => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue(mockSpreadsheet),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms appendRow is called with the provided values.
   */
  it('appends a row with the provided values', () => {
    const values = ['2026-03-30', 'John Doe', 'https://abc.short.gy/xyz123'];

    appendSheetRow(values);

    expect(SpreadsheetApp.openById).toHaveBeenCalledWith('test-spreadsheet-id');
    expect(mockSpreadsheet.getActiveSheet).toHaveBeenCalled();
    expect(mockSheet.appendRow).toHaveBeenCalledWith(values);
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    SpreadsheetApp.openById = vi.fn().mockImplementation(() => {
      throw new Error('Spreadsheet not found');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Spreadsheet not found');
  });

  /**
   * @test
   * @description Confirms appendRow errors propagate to the caller.
   */
  it('propagates appendRow errors', () => {
    mockSheet.appendRow = vi.fn().mockImplementation(() => {
      throw new Error('Write failed');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Write failed');
  });
});
