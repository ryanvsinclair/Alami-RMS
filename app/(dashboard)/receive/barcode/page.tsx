import BarcodeReceivePageClient from "@/features/receiving/barcode/ui/BarcodeReceivePageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

export default function BarcodeScanPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <BarcodeReceivePageClient />
      </DashboardPageContainer>
    </main>
  );
}
