import { redirect } from "next/navigation";
import { HostOrderComposerPageClient } from "@/features/table-service/ui";
import {
  getDiningTableById,
  getMenuSetupData,
  getOrCreateActiveTableSession,
  requireTableServiceAccess,
} from "@/features/table-service/server";

export default async function TableServiceHostPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { businessId } = await requireTableServiceAccess();
  const { table: tableId } = await searchParams;
  if (!tableId) {
    redirect("/service/tables");
  }

  const table = await getDiningTableById(businessId, tableId);
  if (!table) {
    redirect("/service/tables");
  }

  const session = await getOrCreateActiveTableSession(businessId, table.id);
  const menuSetup = await getMenuSetupData(businessId);
  const availableMenuItems = menuSetup.items.filter((item) => item.isAvailable);

  return (
    <main className="mx-auto max-w-3xl p-4 pt-8">
      <HostOrderComposerPageClient
        table={table}
        session={session}
        categories={menuSetup.categories}
        items={availableMenuItems}
      />
    </main>
  );
}
