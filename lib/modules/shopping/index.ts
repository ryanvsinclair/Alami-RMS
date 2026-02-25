import type { ModuleDefinition } from "@/core/types/module";

export const shoppingModule: ModuleDefinition = {
  id: "shopping",
  name: "Shopping",
  description: "Shopping sessions, shelf label scanning, and receipt reconciliation",
  navItems: [
    {
      href: "/shopping",
      label: "Shopping",
      icon: "ShoppingCart",
      position: 3,
    },
  ],
};