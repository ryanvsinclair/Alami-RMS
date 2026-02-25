import type { NormalizedTransaction } from "./types";

/**
 * Uber Eats integration.
 * TODO: Implement using Uber Eats API credentials:
 *   UBER_EATS_CLIENT_ID — OAuth client ID
 *   UBER_EATS_CLIENT_SECRET — OAuth client secret
 *   UBER_EATS_STORE_ID — Restaurant store UUID
 *
 * API docs: https://developer.uber.com/docs/eats/introduction
 */
export async function fetchUberEatsTransactions(
  _since: Date,
  _until: Date
): Promise<NormalizedTransaction[]> {
  // Placeholder — replace with real API call
  return [];
}
