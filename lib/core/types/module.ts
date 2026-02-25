export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  navItems?: {
    href: string;
    label: string;
    icon: string;
    position: number;
  }[];
  dependencies?: string[];
}