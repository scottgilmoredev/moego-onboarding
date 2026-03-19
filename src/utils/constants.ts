/**
 * Constants
 *
 * @module
 * @description Shared constants used across modules.
 */

import { MoeGoEventType } from '#/types/moego.js';

/**
 * The MoeGo webhook event type this application handles.
 */
export const SUPPORTED_EVENT_TYPE = MoeGoEventType.CUSTOMER_CREATED;

/**
 * Required fields on the customer object in a CUSTOMER_CREATED payload.
 */
export const REQUIRED_CUSTOMER_FIELDS = ['id', 'firstName', 'lastName', 'phone'] as const;
