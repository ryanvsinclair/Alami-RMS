import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/shared/ui/card";
import { resolveDiningTableByQrToken } from "@/features/table-service/server";

export default async function TableScanResolverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveDiningTableByQrToken(token);

  if (!resolved) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg p-4 pt-8">
      <Card className="p-5 space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Table Scan</p>
        <h1 className="text-xl font-bold text-foreground">{resolved.business.name}</h1>
        <p className="text-sm text-muted">Table: {resolved.table_number}</p>
        <p className="text-xs text-muted">
          Resolver active for token routing. Host/member/public branching is handled in subsequent RTS steps.
        </p>
        <div className="pt-2">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </Card>
    </main>
  );
}
