import IntakeHubClient from "@/features/intake/ui/IntakeHubClient";

/**
 * Inventory Intake Hub — UI-01.
 * Thin route wrapper; all logic in IntakeHubClient.
 * Existing /shopping and /receive routes are preserved.
 */
export default function IntakePage() {
  return <IntakeHubClient />;
}
