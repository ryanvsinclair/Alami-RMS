import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/shared/ui/card";
import {
  getDiningTableById,
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

  return (
    <main className="mx-auto max-w-lg p-4 pt-8">
      <Card className="p-5 space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Host Workspace</p>
        <h1 className="text-xl font-bold text-foreground">{table.tableNumber}</h1>
        <p className="text-sm text-muted">Active session: {session.id}</p>
        <p className="text-xs text-muted">
          Session-aware routing is active. Host order composer and kitchen ticket actions are completed in RTS-03.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/service/menu" className="text-sm font-semibold text-primary hover:underline">
            Menu Setup
          </Link>
          <Link href="/service/tables" className="text-sm font-semibold text-primary hover:underline">
            Table Setup
          </Link>
        </div>
      </Card>
    </main>
  );
}
