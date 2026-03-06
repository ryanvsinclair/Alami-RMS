import ReceiptReceivePageClient from "@/features/receiving/receipt/ui/ReceiptReceivePageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function ReceiptPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="full" className="px-0 md:px-0 xl:px-0">
        <ReceiptReceivePageClient />
      </DashboardPageContainer>
    </main>
  );
}
