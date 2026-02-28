import type { ModuleDefinition } from "@/core/types/module";
import { shoppingModule } from "@/modules/shopping";
import { receiptsModule } from "@/modules/receipts";
import { integrationsModule } from "@/modules/integrations";
import { tableServiceModule } from "@/modules/table-service";
import { documentsModule } from "@/modules/documents";

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  shopping: shoppingModule,
  receipts: receiptsModule,
  integrations: integrationsModule,
  table_service: tableServiceModule,
  documents: documentsModule,
};

export const MODULE_IDS = Object.keys(MODULE_REGISTRY);
