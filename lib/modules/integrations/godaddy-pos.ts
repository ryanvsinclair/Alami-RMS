import type { NormalizedTransaction } from "./types";

/**
 * GoDaddy POS integration.
 * TODO: Implement using GoDaddy API credentials:
 *   GODADDY_POS_API_KEY — API key from GoDaddy developer portal
 *   GODADDY_POS_STORE_ID — Store/location identifier
 *
 * API docs: https://developer.godaddy.com/doc/endpoint/smartterminal
 */
export async function fetchGoDaddyTransactions(
  _since: Date,
  _until: Date
): Promise<NormalizedTransaction[]> {
  // Placeholder — replace with real API call
  return [];
}
