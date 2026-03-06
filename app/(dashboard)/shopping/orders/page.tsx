"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import {
  getCommittedShoppingSessions,
  reorderShoppingSession,
} from "@/app/actions/modules/shopping";

interface PastSession {
  id: string;
  store_name: string | null;
  store_address: string | null;
  completed_at: string | null;
  staged_subtotal: number | string | null;
  receipt_total: number | string | null;
  _count: { items: number };
  supplier: { name: string } | null;
}

function formatMoney(value: number | string | null | undefined): string {
  const num = value == null ? 0 : Number(value) || 0;
  return `$${num.toFixed(2)}`;
}

export default function PastOrdersPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getCommittedShoppingSessions();
        setSessions(data as PastSession[]);
      } catch {
        setError("Failed to load past orders");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleReorder(sessionId: string) {
    setReorderingId(sessionId);
    setError("");
    try {
      await reorderShoppingSession(sessionId);
      router.push("/shopping");
    } catch {
      setError("Failed to re-order");
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide">
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
        {loading && (
          <p className="py-8 text-center text-sm text-muted md:col-span-2 xl:col-span-3">
            Loading orders...
          </p>
        )}

        {!loading && sessions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted md:col-span-2 xl:col-span-3">
            No past orders yet.
          </p>
        )}

        {sessions.map((session) => (
          <Card key={session.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{session.store_name ?? session.supplier?.name ?? "Unknown Store"}</p>
                <p className="text-xs text-muted mt-0.5">
                  {session.completed_at
                    ? new Date(session.completed_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                  {" · "}
                  {session._count.items} items
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold">
                  {formatMoney(session.receipt_total ?? session.staged_subtotal)}
                </p>
                <Badge variant="success">committed</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/shopping/orders/${session.id}`)}
              >
                View Details
              </Button>
              <Button
                size="sm"
                onClick={() => handleReorder(session.id)}
                loading={reorderingId === session.id}
              >
                Re-order
              </Button>
            </div>
          </Card>
        ))}

        {error && <p className="text-sm text-danger md:col-span-2 xl:col-span-3">{error}</p>}
        </div>
      </DashboardPageContainer>
    </main>
  );
}
