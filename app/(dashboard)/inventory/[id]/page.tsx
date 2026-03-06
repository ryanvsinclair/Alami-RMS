import InventoryDetailPageClient from "@/features/inventory/ui/InventoryDetailPageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/inventory/ui/InventoryDetailPageClient.tsx
export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <InventoryDetailPageClient params={params} />
      </DashboardPageContainer>
    </main>
  );
}
