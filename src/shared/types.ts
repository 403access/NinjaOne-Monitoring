export type Priority = "P1" | "P2" | "P3" | "P4";
export type Severity = "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "NONE";
export type NinjaPriority = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type NodeGroup = "server" | "endpoint" | "network" | "virtualization" | "cloud";

export type ConditionCategory =
  | "performance"
  | "storage"
  | "network"
  | "security"
  | "services"
  | "backup"
  | "virtualization"
  | "patching"
  | "hardware"
  | "custom";

export type ScopeLevel = "global" | "organization" | "location" | "device";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

export type SignalType = "ISP" | "POWER" | "SWITCH" | "MAINTENANCE" | "OTHER";
export type SignalStatus = "active" | "resolved";

export interface Organization {
  id: number;
  name: string;
  description?: string;
  tags: string[];
}

export interface Location {
  id: number;
  organizationId: number;
  name: string;
  address?: string;
  tags: string[];
}

export interface Policy {
  id: number;
  parentPolicyId?: number | null;
  name: string;
  description?: string;
  nodeClass: string;
  nodeClassDefault: boolean;
  tags: string[];
}

export interface Device {
  id: number;
  parentDeviceId?: number | null;
  organizationId: number;
  organizationName: string;
  locationId: number;
  locationName: string;
  displayName: string;
  systemName: string;
  nodeClass: string;
  nodeGroup: NodeGroup;
  os: string;
  role: string;
  offline: boolean;
  lastContact: number;
  lastUpdate: number;
  maintenance: boolean;
  maintenanceUntil?: number;
  tags: string[];
  ip?: string;
  publicIp?: string;
  policyId?: number;
  policyName?: string;
  isNetworkDevice: boolean;
  isVirtualHost: boolean;
  isVirtualGuest: boolean;
}

export interface Alert {
  uid: string;
  deviceId: number;
  message: string;
  subject: string;
  sourceType: string;
  sourceConfigUid?: string;
  sourceName: string;
  category: ConditionCategory;
  severity: Severity;
  ninjaPriority: NinjaPriority;
  createdAt: number;
  updatedAt: number;
  acknowledged: boolean;
  priorityOverride?: Priority;
  data: Record<string, unknown>;
  tags: string[];
  flapping?: boolean;
  resolvedAt?: number;
}

export interface Condition {
  id: string;
  name: string;
  sourceType: string;
  category: ConditionCategory;
  description: string;
  organizationId?: number;
  organizationName?: string;
  locationId?: number;
  locationName?: string;
  scopeLevel: ScopeLevel;
  nodeGroup: NodeGroup;
  nodeClasses: string[];
  policyId?: number;
  policyName: string;
  parentPolicyId?: number | null;
  inherited: boolean;
  enabled: boolean;
  severity: Severity;
  priority: Priority;
  threshold: string;
  duration: string;
  interval: string;
  lastTriggeredAt?: number;
  triggerCount: number;
  source: "ninjaone-activity" | "local-catalog" | "derived";
  tags: string[];
}

export interface Activity {
  id: number;
  deviceId: number;
  activityTime: number;
  type: string;
  activityType: string;
  severity: Severity;
  priority: NinjaPriority;
  status: string;
  sourceName: string;
  sourceConfigUid?: string;
  seriesUid?: string;
  message: string;
}

export interface DeviceHealth {
  deviceId: number;
  healthStatus: "UNKNOWN" | "HEALTHY" | "NEEDS_ATTENTION" | "UNHEALTHY";
  offline: boolean;
  parentOffline: boolean;
  alertCount: number;
}

export interface SnapshotMeta {
  mode: "demo" | "live";
  sourceLabel: string;
  generatedAt: number;
  lastSync: number;
  stale: boolean;
  staleReason?: string;
  version: string;
  tenant?: string;
  counts: {
    devices: number;
    alerts: number;
    conditions: number;
    organizations: number;
    locations: number;
  };
}

export interface Snapshot {
  meta: SnapshotMeta;
  organizations: Organization[];
  locations: Location[];
  policies: Policy[];
  devices: Device[];
  alerts: Alert[];
  conditions: Condition[];
  activities: Activity[];
  health: DeviceHealth[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  dueAt?: number;
  createdAt: number;
  updatedAt: number;
  alertIds: string[];
  deviceIds: number[];
  tags: string[];
  checklist: ChecklistItem[];
  source: "alert" | "manual" | "causality";
  incidentId?: string;
}

export interface SignalScope {
  level: "organization" | "location" | "device";
  organizationId?: number;
  locationId?: number;
  deviceId?: number;
  label: string;
}

export interface SignalEffects {
  suppressInternetChecks: boolean;
  suppressNetworkChecks: boolean;
  suppressAgentAlerts: boolean;
}

export interface ExternalSignal {
  id: string;
  type: SignalType;
  title: string;
  scope: SignalScope;
  startsAt: number;
  endsAt?: number;
  status: SignalStatus;
  notes: string;
  effects: SignalEffects;
  createdBy: string;
  createdAt: number;
}

export interface PriorityRuleMatch {
  severity?: Severity[];
  sourceTypes?: string[];
  sourceTypePrefixes?: string[];
  nodeGroups?: NodeGroup[];
  categories?: ConditionCategory[];
  offline?: boolean;
  olderThanMinutes?: number;
  tags?: string[];
  dataNumberBelow?: Record<string, number>;
}

export interface PriorityRule {
  id: string;
  name: string;
  enabled: boolean;
  match: PriorityRuleMatch;
  priority: Priority;
  reason: string;
}

export type ThemeMode = "dark" | "light" | "system";

export interface Settings {
  mode: "demo" | "live";
  theme: ThemeMode;
  refreshSeconds: number;
  severityMatrix: Record<Severity, Priority>;
  showSuppressed: boolean;
  suppressionThreshold: number;
  autoTaskSuggestions: boolean;
  compactTables: boolean;
}

export interface CausalityRuleConfig {
  id: string;
  enabled: boolean;
  confidence: number;
}

export interface BootstrapPayload {
  snapshot: Snapshot;
  tasks: Task[];
  signals: ExternalSignal[];
  settings: Settings;
  priorityRules: PriorityRule[];
  causalityRules: CausalityRuleConfig[];
}

export interface Suppression {
  alertUid: string;
  ruleId: string;
  ruleName: string;
  rootCauseAlertUid?: string;
  rootCauseDeviceId?: number;
  externalSignalId?: string;
  confidence: number;
  explanation: string;
  evidence: string[];
}

export type IncidentKind =
  | "wan"
  | "switch"
  | "network"
  | "host"
  | "agent"
  | "maintenance"
  | "external"
  | "standalone";

export interface Incident {
  id: string;
  kind: IncidentKind;
  title: string;
  summary: string;
  rootCauseDeviceId?: number;
  rootCauseAlertUid?: string;
  externalSignalId?: string;
  organizationId?: number;
  organizationName?: string;
  locationId?: number;
  locationName?: string;
  alertUids: string[];
  suppressedAlertUids: string[];
  deviceIds: number[];
  priority: Priority;
  confidence: number;
  evidence: string[];
  recommendation: string;
  suggestedTaskTitle: string;
  suggestedTaskPriority: Priority;
  detectedAt: number;
}

export interface CausalLink {
  from: string;
  to: string;
  kind: "root-cause" | "contributes" | "suppresses";
  label: string;
  confidence: number;
}

export interface CausalityStats {
  totalAlerts: number;
  suppressedAlerts: number;
  rootCauses: number;
  incidents: number;
  byRule: Record<string, number>;
  affectedDevices: number;
  affectedLocations: number;
}

export interface CausalityResult {
  incidents: Incident[];
  suppressions: Record<string, Suppression>;
  links: CausalLink[];
  stats: CausalityStats;
}

export interface PriorityResult {
  priority: Priority;
  basePriority: Priority;
  score: number;
  reasons: string[];
  overridden: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  page: string;
  query: string;
  filters: Record<string, string[]>;
  sort: string;
  groupBy?: string;
  createdAt: number;
}
