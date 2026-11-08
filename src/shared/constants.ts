import type {
  CausalityRuleConfig,
  ConditionCategory,
  NodeGroup,
  Priority,
  PriorityRule,
  Severity,
  Settings,
} from "./types";

export const APP_NAME = "Signal";
export const APP_VERSION = "0.1.0";

export const PRIORITY_ORDER: Priority[] = ["P1", "P2", "P3", "P4"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: "P1 · Kritisch",
  P2: "P2 · Hoch",
  P3: "P3 · Normal",
  P4: "P4 · Beobachten",
};

export const PRIORITY_SHORT: Record<Priority, string> = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P4: "P4",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Kritisch",
  MAJOR: "Schwer",
  MODERATE: "Mittel",
  MINOR: "Gering",
  NONE: "Info",
};

export const CATEGORY_LABEL: Record<ConditionCategory, string> = {
  performance: "Performance",
  storage: "Storage",
  network: "Netzwerk",
  security: "Sicherheit",
  services: "Dienste",
  backup: "Backup",
  virtualization: "Virtualisierung",
  patching: "Patching",
  hardware: "Hardware",
  custom: "Custom",
};

export const NODE_GROUP_LABEL: Record<NodeGroup, string> = {
  server: "Server",
  endpoint: "Endpoints",
  network: "Netzwerk",
  virtualization: "Virtualisierung",
  cloud: "Cloud",
};

export const TASK_STATUS_LABEL = {
  open: "Offen",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  done: "Erledigt",
} as const;

export const SIGNAL_TYPE_LABEL = {
  ISP: "Internet / ISP",
  POWER: "Strom",
  SWITCH: "Switch",
  MAINTENANCE: "Wartung",
  OTHER: "Sonstiges",
} as const;

export const SOURCE_LABEL: Record<string, string> = {
  AGENT_OFFLINE: "Agent offline",
  CONDITION_AGENT_CPU: "CPU",
  CONDITION_AGENT_MEMORY: "Memory",
  CONDITION_AGENT_NETWORK: "Netzwerk",
  CONDITION_AGENT_DISK_IO: "Disk I/O",
  CONDITION_AGENT_DISK_FREE_SPACE: "Freier Speicher",
  CONDITION_AGENT_DISK_USAGE: "Disk Usage",
  CONDITION_NMS_CPU: "NMS CPU",
  CONDITION_NMS_MEMORY: "NMS Memory",
  CONDITION_NMS_NETWORK_TRAFFIC_BITS: "NMS Traffic",
  CONDITION_NMS_NETWORK_TRAFFIC_PERCENT: "NMS Traffic %",
  CONDITION_NMS_NETWORK_STATUS: "NMS Adapterstatus",
  CONDITION_NMS_NETWORK_STATUS_CHANGE: "NMS Adapterwechsel",
  CONDITION_PING: "Ping",
  CONDITION_PING_LATENCY: "Ping Latenz",
  CONDITION_PING_PACKET_LOSS: "Ping Packet Loss",
  CONDITION_PING_RESPONSE: "Ping Response",
  CONDITION_SYSTEM_UPTIME: "System Uptime",
  CONDITION_SMART_STATUS_DEGRADED: "SMART Status",
  CONDITION_RAID_HEALTH_STATUS: "RAID Health",
  CONDITION_SCRIPT_RESULT: "Script Result",
  CONDITION_HTTP: "HTTP Check",
  CONDITION_HTTP_RESPONSE: "HTTP Response",
  CONDITION_PORT: "Port Check",
  CONDITION_PORT_SCAN: "Port Scan",
  CONDITION_SYSLOG: "Syslog",
  CONDITION_CONFIGURATION_FILE: "Config File",
  CONDITION_SNMPTRAP: "SNMP Trap",
  CONDITION_CRITICAL_EVENT: "Critical Event",
  CONDITION_DNS: "DNS",
  CONDITION_EMAIL: "E-Mail",
  CONDITION_WINDOWS_EVENT_LOG_TRIGGERED: "Windows Event",
  CONDITION_WINDOWS_SERVICE_STATE_CHANGED: "Windows Service",
  CONDITION_BITLOCKER_STATUS: "BitLocker",
  CONDITION_FILEVAULT_STATUS: "FileVault",
  CONDITION_LINUX_PROCESS: "Linux Process",
  CONDITION_LINUX_DISK_FREE_SPACE: "Linux Disk",
  CONDITION_VM_AGGREGATE_CPU_USAGE: "VM Host CPU",
  CONDITION_VM_DISK_USAGE: "VM Disk",
  CONDITION_VM_HOST_DATASTORE: "Datastore",
  CONDITION_VM_HOST_UPTIME: "VM Host Uptime",
  CONDITION_VM_HOST_DEVICE_DOWN: "VM Host Device Down",
  CONDITION_VM_HOST_BAD_SENSORS: "VM Host Sensoren",
  CONDITION_VM_HOST_SENSOR_HEALTH: "VM Host Sensor Health",
  CONDITION_VM_GUEST_GUEST_OPERATIONAL_MODE: "VM Gastmodus",
  CONDITION_VM_GUEST_SNAPSHOT_SIZE: "VM Snapshot Size",
  CONDITION_VM_GUEST_SNAPSHOT_LIFESPAN: "VM Snapshot Alter",
  CONDITION_VM_GUEST_TOOLS_NOT_RUNNING: "VM Tools",
  CONDITION_HV_GUEST_CHECKPOINT_SIZE: "Checkpoint Size",
  CONDITION_HV_GUEST_CHECKPOINT_LIFESPAN: "Checkpoint Alter",
  CONDITION_SOFTWARE: "Software",
  CONDITION_WINDOWS_PROCESS_STATE: "Windows Process",
  CONDITION_WINDOWS_PROCESS_RESOURCE_CPU: "Prozess CPU",
  CONDITION_WINDOWS_PROCESS_RESOURCE_MEMORY: "Prozess Memory",
  CONDITION_MAC_PROCESS_STATE: "macOS Process",
  CONDITION_MAC_PROCESS_RESOURCE_CPU: "macOS Prozess CPU",
  CONDITION_MAC_PROCESS_RESOURCE_MEMORY: "macOS Prozess Memory",
  CONDITION_MAC_DEAMON: "macOS Daemon",
  AV_QUARANTINE_THREAT: "AV Quarantäne",
  AV_RESTORE_THREAT: "AV Restore",
  AV_DELETE_THREAT: "AV Delete",
  AV_REMOVE_THREAT: "AV Remove",
  BITDEFENDER_RESTORE_THREAT: "Bitdefender Restore",
  BITDEFENDER_DELETE_THREAT: "Bitdefender Delete",
  SHADOWPROTECT_BACKUPJOB_CREATE: "Backup Job",
  SHADOWPROTECT_BACKUPJOB_UPDATE: "Backup Job",
  SHADOWPROTECT_BACKUPJOB_DELETE: "Backup Job",
  SHADOWPROTECT_BACKUPJOB_EXECUTE: "Backup Job",
  IMAGEMANAGER_MANAGEDFOLDER_CREATE: "ImageManager",
  IMAGEMANAGER_MANAGEDFOLDER_UPDATE: "ImageManager",
  IMAGEMANAGER_MANAGEDFOLDER_DELETE: "ImageManager",
  IMAGEMANAGER_MANAGEDFOLDER_EXECUTE: "ImageManager",
};

export const DEFAULT_SEVERITY_MATRIX: Record<Severity, Priority> = {
  CRITICAL: "P1",
  MAJOR: "P2",
  MODERATE: "P3",
  MINOR: "P4",
  NONE: "P4",
};

export const DEFAULT_PRIORITY_RULES: PriorityRule[] = [
  {
    id: "rule-server-offline",
    name: "Server oder Host offline",
    enabled: true,
    match: {
      sourceTypes: ["AGENT_OFFLINE", "CONDITION_PING_RESPONSE", "CONDITION_NMS_NETWORK_STATUS"],
      nodeGroups: ["server", "virtualization", "network"],
    },
    priority: "P1",
    reason: "Ein offline Server, Host oder Netzwerkgerät ist ein potenzieller Ausfall mit Breitenwirkung.",
  },
  {
    id: "rule-security",
    name: "Sicherheitsvorfall",
    enabled: true,
    match: { sourceTypePrefixes: ["AV_", "BITDEFENDER_"], categories: ["security"] },
    priority: "P1",
    reason: "Aktive Bedrohungen werden unabhängig vom Gerätetyp sofort eskaliert.",
  },
  {
    id: "rule-smart",
    name: "SMART / RAID kritisch",
    enabled: true,
    match: { sourceTypes: ["CONDITION_SMART_STATUS_DEGRADED", "CONDITION_RAID_HEALTH_STATUS"] },
    priority: "P1",
    reason: "Ein drohender Datenträgerausfall ist zeitkritisch.",
  },
  {
    id: "rule-disk-critical",
    name: "Speicher fast voll",
    enabled: true,
    match: { sourceTypes: ["CONDITION_AGENT_DISK_FREE_SPACE"], dataNumberBelow: { freePercent: 5 } },
    priority: "P1",
    reason: "Unter 5 % freiem Speicher drohen Ausfälle von Diensten und Backups.",
  },
  {
    id: "rule-service-prod",
    name: "Dienst auf Server gestoppt",
    enabled: true,
    match: { sourceTypes: ["CONDITION_WINDOWS_SERVICE_STATE_CHANGED"], nodeGroups: ["server"] },
    priority: "P2",
    reason: "Ein gestoppter Dienst auf einem Server ist meist kundenwirksam.",
  },
  {
    id: "rule-aging-critical",
    name: "Kritisch und älter als 30 Minuten",
    enabled: true,
    match: { severity: ["CRITICAL"], olderThanMinutes: 30 },
    priority: "P1",
    reason: "Ein ungelöster kritischer Alarm gewinnt mit der Zeit an Eskalationsdruck.",
  },
  {
    id: "rule-network-core",
    name: "Netzwerkgerät betroffen",
    enabled: true,
    match: { nodeGroups: ["network"], categories: ["network"] },
    priority: "P2",
    reason: "Netzwerkausfälle haben überproportionalen Impact auf abhängige Geräte.",
  },
];

export const DEFAULT_CAUSALITY_RULES: CausalityRuleConfig[] = [
  { id: "maintenance", enabled: true, confidence: 0.99 },
  { id: "wan-outage", enabled: true, confidence: 0.9 },
  { id: "switch-down", enabled: true, confidence: 0.94 },
  { id: "network-path", enabled: true, confidence: 0.9 },
  { id: "parent-offline", enabled: true, confidence: 0.96 },
  { id: "agent-offline", enabled: true, confidence: 0.98 },
  { id: "external-signal", enabled: true, confidence: 0.85 },
  { id: "flapping", enabled: true, confidence: 0.8 },
];

export const DEFAULT_SETTINGS: Settings = {
  mode: "demo",
  theme: "dark",
  refreshSeconds: 120,
  severityMatrix: DEFAULT_SEVERITY_MATRIX,
  showSuppressed: false,
  suppressionThreshold: 0.7,
  autoTaskSuggestions: true,
  compactTables: false,
};

export const AGENT_SOURCE_TYPES = new Set([
  "AGENT_OFFLINE",
  "CONDITION_AGENT_CPU",
  "CONDITION_AGENT_MEMORY",
  "CONDITION_AGENT_NETWORK",
  "CONDITION_AGENT_DISK_IO",
  "CONDITION_AGENT_DISK_FREE_SPACE",
  "CONDITION_AGENT_DISK_USAGE",
  "CONDITION_SYSTEM_UPTIME",
  "CONDITION_SCRIPT_RESULT",
  "CONDITION_WINDOWS_EVENT_LOG_TRIGGERED",
  "CONDITION_WINDOWS_SERVICE_STATE_CHANGED",
  "CONDITION_CRITICAL_EVENT",
  "CONDITION_SOFTWARE",
  "CONDITION_RAID_HEALTH_STATUS",
  "CONDITION_SMART_STATUS_DEGRADED",
  "CONDITION_BITLOCKER_STATUS",
  "CONDITION_FILEVAULT_STATUS",
  "CONDITION_LINUX_PROCESS",
  "CONDITION_LINUX_Daemon",
  "CONDITION_LINUX_PROCESS_RESOURCE",
  "CONDITION_LINUX_PROCESS_RESOURCE_CPU",
  "CONDITION_LINUX_PROCESS_RESOURCE_MEMORY",
  "CONDITION_LINUX_DISK_FREE_SPACE",
  "CONDITION_LINUX_DISK_USAGE",
  "CONDITION_WINDOWS_PROCESS_STATE",
  "CONDITION_WINDOWS_PROCESS_RESOURCE_CPU",
  "CONDITION_WINDOWS_PROCESS_RESOURCE_MEMORY",
  "CONDITION_MAC_PROCESS_STATE",
  "CONDITION_MAC_PROCESS_RESOURCE_CPU",
  "CONDITION_MAC_PROCESS_RESOURCE_MEMORY",
  "CONDITION_MAC_DEAMON",
  "CONDITION_VM_GUEST_TOOLS_NOT_RUNNING",
  "CONDITION_VM_GUEST_GUEST_OPERATIONAL_MODE",
  "CONDITION_VM_GUEST_SNAPSHOT_SIZE",
  "CONDITION_VM_GUEST_SNAPSHOT_LIFESPAN",
  "CONDITION_HV_GUEST_CHECKPOINT_SIZE",
  "CONDITION_HV_GUEST_CHECKPOINT_LIFESPAN",
  "CONDITION_VM_AGGREGATE_CPU_USAGE",
  "CONDITION_VM_DISK_USAGE",
  "CONDITION_VM_HOST_DATASTORE",
  "CONDITION_VM_HOST_UPTIME",
  "CONDITION_VM_HOST_DEVICE_DOWN",
  "CONDITION_VM_HOST_BAD_SENSORS",
  "CONDITION_VM_HOST_SENSOR_HEALTH",
]);

export const INTERNET_SOURCE_TYPES = new Set([
  "CONDITION_HTTP",
  "CONDITION_HTTP_RESPONSE",
  "CONDITION_DNS",
  "CONDITION_EMAIL",
  "CONDITION_PING_RESPONSE",
  "CONDITION_PING",
  "CONDITION_PING_LATENCY",
  "CONDITION_PING_PACKET_LOSS",
]);

export const NETWORK_SOURCE_TYPES = new Set([
  "CONDITION_NMS_CPU",
  "CONDITION_NMS_MEMORY",
  "CONDITION_NMS_NETWORK_TRAFFIC_BITS",
  "CONDITION_NMS_NETWORK_TRAFFIC_PERCENT",
  "CONDITION_NMS_NETWORK_STATUS",
  "CONDITION_NMS_NETWORK_STATUS_CHANGE",
  "CONDITION_PING",
  "CONDITION_PING_LATENCY",
  "CONDITION_PING_PACKET_LOSS",
  "CONDITION_PING_RESPONSE",
  "CONDITION_PORT",
  "CONDITION_PORT_SCAN",
  "CONDITION_SNMPTRAP",
  "CONDITION_SYSLOG",
  "CONDITION_CONFIGURATION_FILE",
  "CONDITION_HTTP",
  "CONDITION_HTTP_RESPONSE",
]);

export const SECURITY_SOURCE_PREFIXES = ["AV_", "BITDEFENDER_"];

export const SECURITY_SOURCE_TYPES = new Set([
  "CONDITION_BITLOCKER_STATUS",
  "CONDITION_FILEVAULT_STATUS",
  "CONDITION_CRITICAL_EVENT",
  "CONDITION_WINDOWS_EVENT_LOG_TRIGGERED",
]);

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  P1: 1000,
  P2: 700,
  P3: 400,
  P4: 100,
};

export function severityRank(severity: Severity): number {
  switch (severity) {
    case "CRITICAL":
      return 5;
    case "MAJOR":
      return 4;
    case "MODERATE":
      return 3;
    case "MINOR":
      return 2;
    default:
      return 1;
  }
}

export function priorityRank(priority: Priority): number {
  return { P1: 1, P2: 2, P3: 3, P4: 4 }[priority];
}

export function bumpPriority(priority: Priority, steps: number): Priority {
  const index = Math.max(0, Math.min(3, priorityRank(priority) - 1 + steps));
  return PRIORITY_ORDER[index] ?? priority;
}

export function isAgentSource(sourceType: string): boolean {
  return AGENT_SOURCE_TYPES.has(sourceType) || sourceType.startsWith("SHADOWPROTECT_") || sourceType.startsWith("IMAGEMANAGER_");
}

export function isInternetSource(sourceType: string): boolean {
  return INTERNET_SOURCE_TYPES.has(sourceType);
}

export function isNetworkSource(sourceType: string): boolean {
  return NETWORK_SOURCE_TYPES.has(sourceType);
}

export function isSecuritySource(sourceType: string): boolean {
  return (
    SECURITY_SOURCE_TYPES.has(sourceType) ||
    SECURITY_SOURCE_PREFIXES.some((prefix) => sourceType.startsWith(prefix))
  );
}

export function categoryForSourceType(sourceType: string): ConditionCategory {
  if (SECURITY_SOURCE_PREFIXES.some((prefix) => sourceType.startsWith(prefix))) return "security";
  if (sourceType.includes("DISK") || sourceType.includes("DATASTORE") || sourceType.includes("SNAPSHOT") || sourceType.includes("CHECKPOINT")) {
    return "storage";
  }
  if (sourceType.includes("CPU") || sourceType.includes("MEMORY") || sourceType.includes("UPTIME") || sourceType.includes("DISK_IO")) {
    return "performance";
  }
  if (sourceType.includes("NETWORK") || sourceType.includes("PING") || sourceType.includes("HTTP") || sourceType.includes("PORT") || sourceType.includes("DNS") || sourceType.includes("SNMP") || sourceType.includes("SYSLOG") || sourceType.includes("CONFIGURATION")) {
    return "network";
  }
  if (sourceType.includes("SERVICE") || sourceType.includes("PROCESS") || sourceType.includes("DAEMON") || sourceType.includes("EVENT") || sourceType.includes("AGENT_OFFLINE")) {
    return "services";
  }
  if (sourceType.includes("BACKUP") || sourceType.includes("SHADOWPROTECT") || sourceType.includes("IMAGEMANAGER")) return "backup";
  if (sourceType.includes("VM_") || sourceType.includes("HV_") || sourceType.includes("HYPERV")) return "virtualization";
  if (sourceType.includes("PATCH") || sourceType.includes("SOFTWARE")) return "patching";
  if (sourceType.includes("SMART") || sourceType.includes("RAID") || sourceType.includes("BATTERY")) return "hardware";
  if (sourceType.startsWith("CONDITION_")) return "custom";
  return "custom";
}

export function nodeGroupForClass(nodeClass: string): NodeGroup {
  if (nodeClass.startsWith("NMS_")) {
    if (nodeClass === "NMS_VIRTUAL_MACHINE" || nodeClass === "NMS_VM_HOST") return "virtualization";
    return "network";
  }
  if (nodeClass.includes("VM_HOST") || nodeClass.includes("VM_GUEST") || nodeClass.includes("HYPERV")) return "virtualization";
  if (nodeClass.includes("SERVER")) return "server";
  if (nodeClass === "CLOUD_MONITOR_TARGET") return "cloud";
  return "endpoint";
}

export function nodeGroupForNodeClass(nodeClass: string): NodeGroup {
  return nodeGroupForClass(nodeClass);
}
