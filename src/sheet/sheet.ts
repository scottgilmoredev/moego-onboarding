/**
 * Google Sheets Client
 *
 * @module
 * @description Appends rows to a configured Google Sheet via SpreadsheetApp.
 */

import { getConfig } from '#/utils/config.js';

/**
 * Append a row to the configured Google Sheet.
 *
 * @function appendSheetRow
 * @description Opens the configured spreadsheet and appends the provided
 * values as a new row to the active sheet. Throws on any SpreadsheetApp
 * or write failure.
 *
 * @param {unknown[]} values - The cell values to append, in column order.
 * @throws {Error} If the spreadsheet cannot be opened or the row cannot be written.
 */
export function appendSheetRow(values: unknown[]): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();

  sheet.appendRow(values);
}
