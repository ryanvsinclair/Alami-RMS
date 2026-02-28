import type { ModuleDefinition } from "@/core/types/module";

export const documentsModule: ModuleDefinition = {
  id: "documents",
  name: "Documents",
  description: "Inbound document capture, draft review, and trust-gated posting",
  navItems: [
    {
      href: "/documents",
      label: "Documents",
      icon: "Inbox",
      position: 4,
    },
  ],
};
