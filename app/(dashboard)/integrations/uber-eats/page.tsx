import Link from "next/link";
import { requireBusinessMembership, requireRole } from "@/core/auth/tenant";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import {
  UBER_EATS_V1_CAPABILITIES,
  listUberEatsMerchantStores,
} from "@/features/integrations/server";

type SearchParams = {
  provision?: string;
  deprovision?: string;
  store_id?: string;
  error?: string;
};

function statusToneClass(enabled: boolean) {
  return enabled
    ? "border-success/35 bg-success/10 text-success"
    : "border-border/60 bg-card text-muted";
}

export default async function UberEatsIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { business, membership } = await requireBusinessMembership();
  requireRole("manager", membership.role);
  const params = await searchParams;

  let stores = [] as Awaited<ReturnType<typeof listUberEatsMerchantStores>>;
  let loadError: string | null = null;

  try {
    stores = await listUberEatsMerchantStores(business.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load Uber Eats stores";
  }

  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide">
        <div className="space-y-5">
          <div className="rounded-3xl bg-card px-5 py-5 shadow-(--surface-card-shadow)">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                  Uber Eats
                </p>
                <h1 className="text-2xl font-semibold text-foreground">Store Provisioning</h1>
                <p className="max-w-3xl text-sm text-muted">
                  Sandbox provisioning for the connected Uber merchant. This V1 surface is locked to
                  income, menu publishing, availability, and store status. Order actions remain out
                  of scope.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/integrations"
                  className="rounded-xl border border-border/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.03]"
                >
                  Back to Integrations
                </Link>
                <Link
                  href="/api/integrations/oauth/uber_eats/start?return_to=%2Fintegrations%2Fuber-eats"
                  className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Reconnect Uber
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(UBER_EATS_V1_CAPABILITIES).map(([key, enabled]) => (
                <span
                  key={key}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${statusToneClass(enabled)}`}
                >
                  {key}
                </span>
              ))}
            </div>
          </div>

          {params.provision === "success" && (
            <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              Store provisioned successfully{params.store_id ? ` (${params.store_id})` : ""}.
            </div>
          )}
          {params.deprovision === "success" && (
            <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              Store deprovisioned successfully{params.store_id ? ` (${params.store_id})` : ""}.
            </div>
          )}
          {(params.error || loadError) && (
            <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {params.error ?? loadError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stores.map((store) => {
              const actionHref = store.integrationEnabled
                ? `/api/integrations/uber-eats/stores/deprovision?store_id=${encodeURIComponent(store.id)}&return_to=%2Fintegrations%2Fuber-eats`
                : `/api/integrations/uber-eats/stores/provision?store_id=${encodeURIComponent(store.id)}&return_to=%2Fintegrations%2Fuber-eats`;

              return (
                <div
                  key={store.id}
                  className="rounded-3xl bg-card px-5 py-5 shadow-(--surface-card-shadow)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-foreground">
                        {store.displayName ?? store.name ?? store.id}
                      </h2>
                      <p className="text-xs text-muted">{store.id}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusToneClass(store.integrationEnabled)}`}>
                      {store.integrationEnabled ? "Provisioned" : "Not provisioned"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-muted">
                    <p>{store.address ?? "Address not available"}</p>
                    <p>{store.city ?? "City not available"}</p>
                    <p>Environment: {store.environment}</p>
                    <p>Integrator store ID: {store.integratorStoreId ?? "Not set"}</p>
                    <p>Order manager pending: {store.isOrderManagerPending ? "Yes" : "No"}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <Link
                      href={actionHref}
                      className={
                        store.integrationEnabled
                          ? "rounded-xl border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                          : "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                      }
                    >
                      {store.integrationEnabled ? "Deprovision" : "Provision"}
                    </Link>
                    <p className="text-xs text-muted">
                      {store.integrationEnabled
                        ? "Disconnects this merchant location from the Uber POS integration."
                        : "Creates the Uber POS linkage for this merchant location."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {!loadError && stores.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border/60 px-6 py-10 text-sm text-muted">
              No Uber Eats stores were returned for the connected merchant yet. This usually means
              the sandbox merchant has not been assigned test stores by Uber.
            </div>
          )}
        </div>
      </DashboardPageContainer>
    </main>
  );
}
