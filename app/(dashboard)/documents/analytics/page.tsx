import { DocumentAnalyticsClient } from "@/features/documents/ui";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function DocumentAnalyticsPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <DocumentAnalyticsClient />
      </DashboardPageContainer>
    </main>
  );
}
