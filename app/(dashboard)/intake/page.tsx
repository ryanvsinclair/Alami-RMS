import IntakeHubClient from "@/features/intake/ui/IntakeHubClient";

/**
 * Inventory Intake Hub.
 * Thin route wrapper; all logic in IntakeHubClient.
 */
export default function IntakePage() {
  return <IntakeHubClient />;
}
