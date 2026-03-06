import MenuSetupPageClient from "@/features/table-service/ui/MenuSetupPageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function TableServiceMenuPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <MenuSetupPageClient />
      </DashboardPageContainer>
    </main>
  );
}
