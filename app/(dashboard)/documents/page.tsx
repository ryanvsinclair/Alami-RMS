import { DocumentInboxClient } from "@/features/documents/ui";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function DocumentsInboxPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="full" className="px-0 md:px-0 xl:px-0">
        <DocumentInboxClient />
      </DashboardPageContainer>
    </main>
  );
}
