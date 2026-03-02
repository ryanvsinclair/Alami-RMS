import type { ModuleDefinition } from "@/core/types/module";
import { shoppingModule } from "@/modules/shopping";
import { receiptsModule } from "@/modules/receipts";
import { tableServiceModule } from "@/modules/table-service";
import { documentsModule } from "@/modules/documents";

// Note: integrations is a core feature, not a module — accessible to all businesses unconditionally.
// lib/modules/integrations/ remains for its provider types/adapters consumed by financial.ts and others.
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  shopping: shoppingModule,
  receipts: receiptsModule,
  table_service: tableServiceModule,
  documents: documentsModule,
};

export const MODULE_IDS = Object.keys(MODULE_REGISTRY);
