"use client";

import { useRouter } from "next/navigation";
import {
  hasAppLockPin,
  lockAppToScope,
  type AppLockScope,
} from "@/shared/utils/app-lock";

function ServiceWorkspaceCard({
  title,
  description,
  route,
  scope,
}: {
  title: string;
  description: string;
  route: string;
  scope: AppLockScope;
}) {
  const router = useRouter();

  function openRoute() {
    router.push(route);
  }

  function lockToRoute() {
    if (!hasAppLockPin()) {
      window.alert("Set a 4-digit PIN in Settings before enabling lock mode.");
      router.push("/settings");
      return;
    }
    lockAppToScope(scope);
    router.push(route);
  }

  return (
    <section className="design-glass-surface p-5">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={openRoute}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
        >
          Open
        </button>
        <button
          type="button"
          onClick={lockToRoute}
          className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          Lock Here
        </button>
      </div>
    </section>
  );
}

export default function TableServiceIndexPage() {
  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <section className="design-glass-surface p-5">
          <h1 className="text-xl font-bold text-foreground">Service Workspace</h1>
          <p className="mt-1 text-sm text-muted">Choose where to continue.</p>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <ServiceWorkspaceCard
            title="Table"
            description="Table setup and host order-taking workspace."
            route="/service/table"
            scope="table"
          />
          <ServiceWorkspaceCard
            title="Kitchen"
            description="Active and completed kitchen queues."
            route="/service/kitchen"
            scope="kitchen"
          />
        </div>
      </div>
    </main>
  );
}
