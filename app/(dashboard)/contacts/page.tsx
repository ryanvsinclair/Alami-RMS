import ContactsPageClient from "@/features/contacts/ui/ContactsPageClient";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";

// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/contacts/ui/ContactsPageClient.tsx
export default function ContactsPage() {
  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide" className="px-0 md:px-0 xl:px-0">
        <ContactsPageClient />
      </DashboardPageContainer>
    </main>
  );
}
