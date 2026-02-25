import type { MatchConfidence } from "@/lib/generated/prisma/client";

// ============================================================
// Confidence scoring and thresholds
// ============================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8, // auto-assign
  MEDIUM: 0.5, // suggest + quick confirm
  LOW: 0.2, // show as option but require input
} as const;

export function scoreToConfidence(score: number): MatchConfidence {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return "low";
  return "none";
}
