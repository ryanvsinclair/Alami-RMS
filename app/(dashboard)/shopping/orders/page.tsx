"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/nav/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCommittedShoppingSessions,
  reorderShoppingSession,
} from "@/app/actions/shopping";

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
    <>
      <PageHeader title="Past Orders" backHref="/shopping" />
      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-sm text-muted text-center py-8">Loading orders...</p>
        )}

        {!loading && sessions.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No past orders yet.</p>
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

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </>
  );
}
