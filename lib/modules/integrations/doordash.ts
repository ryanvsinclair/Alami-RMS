import type { NormalizedTransaction } from "./types";

/**
 * DoorDash integration.
 * TODO: Implement using DoorDash Drive API credentials:
 *   DOORDASH_DEVELOPER_ID — Developer ID from DoorDash portal
 *   DOORDASH_KEY_ID — API key ID
 *   DOORDASH_SIGNING_SECRET — JWT signing secret
 *   DOORDASH_STORE_ID — Store location identifier
 *
 * API docs: https://developer.doordash.com/en-US/api/drive
 */
export async function fetchDoorDashTransactions(
  _since: Date,
  _until: Date
): Promise<NormalizedTransaction[]> {
  // Placeholder — replace with real API call
  return [];
}
