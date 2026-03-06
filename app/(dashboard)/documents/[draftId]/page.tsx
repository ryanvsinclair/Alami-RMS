import { DocumentDraftDetailClient } from "@/features/documents/ui";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function DocumentDraftPage({
  params,
}: {
  params: { draftId: string };
}) {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="full" className="px-0 md:px-0 xl:px-0">
        <DocumentDraftDetailClient draftId={params.draftId} />
      </DashboardPageContainer>
    </main>
  );
}
