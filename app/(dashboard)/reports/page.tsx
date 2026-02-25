"use client";

import { Card } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="p-4 space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Reports</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Reports</h1>
        <p className="mt-2 text-sm text-muted">
          Reports page placeholder. Add financial and inventory reports here.
        </p>
      </Card>
    </div>
  );
}
