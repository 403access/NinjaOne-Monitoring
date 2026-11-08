import {
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  ListTree,
  MonitorSmartphone,
  Settings2,
  Siren,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  group: "Betrieb" | "Konfiguration" | "System";
  badge?: "alerts" | "incidents" | "tasks";
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Lagebild",
    shortLabel: "Lage",
    description: "KPIs, Ursachen und Standort-Health",
    icon: LayoutDashboard,
    group: "Betrieb",
  },
  {
    path: "/alerts",
    label: "Alarme",
    shortLabel: "Alarme",
    description: "Priorisierte Alarme, Filter und Bulk-Aktionen",
    icon: Siren,
    group: "Betrieb",
    badge: "alerts",
  },
  {
    path: "/causality",
    label: "Kausalität",
    shortLabel: "Ursachen",
    description: "Incidents, Suppression und externe Signale",
    icon: GitBranch,
    group: "Betrieb",
    badge: "incidents",
  },
  {
    path: "/tasks",
    label: "Aufgaben",
    shortLabel: "Aufgaben",
    description: "Board, Fristen und verknüpfte Alarme",
    icon: ClipboardCheck,
    group: "Betrieb",
    badge: "tasks",
  },
  {
    path: "/conditions",
    label: "Bedingungen",
    shortLabel: "Regeln",
    description: "Condition-Katalog und Hierarchie",
    icon: ListTree,
    group: "Konfiguration",
  },
  {
    path: "/devices",
    label: "Geräte",
    shortLabel: "Geräte",
    description: "Inventar, Status und Parent-Topologie",
    icon: MonitorSmartphone,
    group: "Konfiguration",
  },
  {
    path: "/settings",
    label: "Einstellungen",
    shortLabel: "Mehr",
    description: "Datenquelle, Theme und Regeln",
    icon: Settings2,
    group: "System",
  },
];

export const MOBILE_NAV_PATHS = ["/", "/alerts", "/causality", "/tasks"];

export function navItemForPath(pathname: string): NavItem {
  if (pathname === "/") return NAV_ITEMS[0]!;
  return NAV_ITEMS.find((item) => item.path !== "/" && pathname.startsWith(item.path)) ?? NAV_ITEMS[0]!;
}
