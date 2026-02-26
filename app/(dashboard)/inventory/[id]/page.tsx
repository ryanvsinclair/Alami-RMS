import InventoryDetailPageClient from "@/features/inventory/ui/InventoryDetailPageClient";

// Transitional wrapper during app-structure refactor.
// Canonical implementation lives in: src/features/inventory/ui/InventoryDetailPageClient.tsx
export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <InventoryDetailPageClient params={params} />;
}
