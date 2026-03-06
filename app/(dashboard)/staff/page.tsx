import StaffPageClient from "@/features/staff/ui/StaffPageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/staff/ui/StaffPageClient.tsx
export default function StaffPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <StaffPageClient />
      </DashboardPageContainer>
    </main>
  );
}
