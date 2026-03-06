import ScheduleClient from "@/features/schedule/ui/ScheduleClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

/**
 * Operational Calendar — Schedule page.
 * Thin route wrapper; all logic in ScheduleClient.
 */
export default function SchedulePage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="full" className="px-0 md:px-0 xl:px-0">
        <ScheduleClient />
      </DashboardPageContainer>
    </main>
  );
}
