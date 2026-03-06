import InventoryListPageClient from "@/features/inventory/ui/InventoryListPageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/inventory/ui/InventoryListPageClient.tsx
export default function InventoryPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="full" className="px-0 md:px-0 xl:px-0">
        <InventoryListPageClient />
      </DashboardPageContainer>
    </main>
  );
}
