import ManualReceivePageClient from "@/features/receiving/manual/ui/ManualReceivePageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function ManualEntryPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <ManualReceivePageClient />
      </DashboardPageContainer>
    </main>
  );
}
