import type { ModuleDefinition } from "@/core/types/module";

export const receiptsModule: ModuleDefinition = {
  id: "receipts",
  name: "Receipts",
  description: "Receipt scanning, OCR, and line-item matching",
  navItems: [
    {
      href: "/receive",
      label: "Receive",
      icon: "Inbox",
      position: 2,
    },
  ],
};