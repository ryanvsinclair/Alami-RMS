import KitchenQueuePageClient from "@/features/table-service/ui/KitchenQueuePageClient";
import {
  getKitchenQueue,
  requireTableServiceAccess,
} from "@/features/table-service/server";
import type { TableServiceKitchenQueueEntry } from "@/features/table-service/shared";

export default async function TableServiceKitchenPage() {
  const { businessId } = await requireTableServiceAccess();
  const queue = (await getKitchenQueue(businessId)) as TableServiceKitchenQueueEntry[];

  return <KitchenQueuePageClient initialQueue={queue} />;
}
