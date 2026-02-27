import type { IncomeConnectionStatus } from "@/features/integrations/shared";
import { Badge } from "@/shared/ui/badge";

const statusLabel: Record<IncomeConnectionStatus, string> = {
  not_connected: "Not Connected",
  connected: "Connected",
  error: "Error",
};

const statusVariant: Record<IncomeConnectionStatus, "default" | "success" | "danger"> = {
  not_connected: "default",
  connected: "success",
  error: "danger",
};

export function ConnectionStatusBadge({ status }: { status: IncomeConnectionStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>;
}
