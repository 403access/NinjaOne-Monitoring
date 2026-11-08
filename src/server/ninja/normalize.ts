import {
  DEFAULT_SEVERITY_MATRIX,
  categoryForSourceType,
  nodeGroupForNodeClass,
  priorityRank,
  severityRank,
} from "../../shared/constants";
import type {
  Activity,
  Alert,
  Condition,
  Device,
  DeviceHealth,
  Location,
  Organization,
  Policy,
  Severity,
  Snapshot,
  SnapshotMeta,
} from "../../shared/types";

export interface RawNinjaBundle {
  alerts: unknown[];
  devices: unknown[];
  policies: unknown[];
  organizations: unknown[];
  locations: unknown[];
  activities: unknown[];
  health: unknown;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function toMillis(value: unknown): number {
  const numeric = numberValue(value);
  if (numeric !== undefined) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function firstIp(value: unknown): string | undefined {
  const first = array(value)[0];
  if (typeof first === "string") return first;
  const entry = record(first);
  return text(entry.ipAddress) ?? text(entry.address) ?? text(entry.ip);
}

function validSeverity(value: unknown): Severity | undefined {
  const candidate = text(value)?.toUpperCase();
  if (candidate === "CRITICAL" || candidate === "MAJOR" || candidate === "MODERATE" || candidate === "MINOR" || candidate === "NONE") {
    return candidate;
  }
  return undefined;
}

function deriveSeverity(sourceType: string): Severity {
  if (
    sourceType === "AGENT_OFFLINE" ||
    sourceType.includes("SMART") ||
    sourceType.includes("RAID") ||
    sourceType.startsWith("AV_") ||
    sourceType.startsWith("BITDEFENDER_") ||
    sourceType.includes("DEVICE_DOWN")
  ) {
    return "CRITICAL";
  }
  if (sourceType.includes("DISK_FREE") || sourceType.includes("SERVICE") || sourceType.includes("HTTP") || sourceType.includes("PING_RESPONSE")) {
    return "MAJOR";
  }
  if (sourceType.includes("CPU") || sourceType.includes("MEMORY") || sourceType.includes("PING")) return "MODERATE";
  return "MINOR";
}

function deriveNinjaPriority(severity: Severity): "HIGH" | "MEDIUM" | "LOW" | "NONE" {
  if (severity === "CRITICAL") return "HIGH";
  if (severity === "MAJOR") return "MEDIUM";
  if (severity === "MODERATE" || severity === "MINOR") return "LOW";
  return "NONE";
}

function nodeFlags(nodeClass: string): { isNetworkDevice: boolean; isVirtualHost: boolean; isVirtualGuest: boolean } {
  const upper = nodeClass.toUpperCase();
  return {
    isNetworkDevice: /NMS_(SWITCH|ROUTER|FIREWALL|PRIVATE_NETWORK_GATEWAY|APPLIANCE)/.test(upper),
    isVirtualHost: upper.includes("VM_HOST") || upper.includes("HYPERV_VMM_HOST"),
    isVirtualGuest: upper.includes("VM_GUEST") || upper.includes("HYPERV_VMM_GUEST"),
  };
}

function normalizeMaintenance(value: unknown): { maintenance: boolean; maintenanceUntil?: number } {
  const maintenance = record(value);
  const status = text(maintenance.status)?.toUpperCase();
  const until = numberValue(maintenance.end);
  return {
    maintenance: status === "IN_MAINTENANCE" || status === "PENDING",
    maintenanceUntil: until !== undefined ? toMillis(until) : undefined,
  };
}

export function normalizeDevice(raw: unknown, index: number): Device {
  const value = record(raw);
  const references = record(value.references);
  const organization = record(references.organization);
  const location = record(references.location);
  const policy = record(references.policy);
  const role = record(references.role);
  const nodeClass = text(value.nodeClass) ?? "UNKNOWN";
  const flags = nodeFlags(nodeClass);
  const maintenance = normalizeMaintenance(value.maintenance);
  const policyId = numberValue(value.policyId) ?? numberValue(policy.id) ?? numberValue(value.rolePolicyId);
  return {
    id: numberValue(value.id) ?? index + 1,
    parentDeviceId: numberValue(value.parentDeviceId) ?? null,
    organizationId: numberValue(value.organizationId) ?? numberValue(organization.id) ?? 0,
    organizationName: text(organization.name) ?? "Unbekannte Organisation",
    locationId: numberValue(value.locationId) ?? numberValue(location.id) ?? 0,
    locationName: text(location.name) ?? "Unbekannter Standort",
    displayName: text(value.displayName) ?? text(value.systemName) ?? `Device ${numberValue(value.id) ?? index + 1}`,
    systemName: text(value.systemName) ?? text(value.displayName) ?? "",
    nodeClass,
    nodeGroup: nodeGroupForNodeClass(nodeClass),
    os: text(value.deviceType) ?? text(value.os) ?? nodeClass,
    role: text(role.name) ?? text(value.deviceType) ?? nodeClass,
    offline: booleanValue(value.offline) ?? false,
    lastContact: toMillis(value.lastContact),
    lastUpdate: toMillis(value.lastUpdate),
    maintenance: maintenance.maintenance,
    maintenanceUntil: maintenance.maintenanceUntil,
    tags: array(value.tags).filter((tag): tag is string => typeof tag === "string"),
    ip: firstIp(value.ipAddresses),
    publicIp: text(value.publicIP),
    policyId,
    policyName: text(policy.name) ?? (policyId ? `Policy ${policyId}` : undefined),
    ...flags,
  };
}

export function normalizeAlert(raw: unknown, deviceMap: Map<number, Device>): Alert {
  const value = record(raw);
  const data = record(value.data);
  const sourceType = text(value.sourceType) ?? "UNKNOWN";
  const severity = validSeverity(data.severity) ?? validSeverity(data.alertSeverity) ?? deriveSeverity(sourceType);
  const ninjaPriorityCandidate = text(data.priority)?.toUpperCase();
  const ninjaPriority =
    ninjaPriorityCandidate === "HIGH" || ninjaPriorityCandidate === "MEDIUM" || ninjaPriorityCandidate === "LOW" || ninjaPriorityCandidate === "NONE"
      ? ninjaPriorityCandidate
      : deriveNinjaPriority(severity);
  const deviceId = numberValue(value.deviceId) ?? numberValue(record(value.device).id) ?? 0;
  const device = deviceMap.get(deviceId);
  return {
    uid: text(value.uid) ?? `alert-${deviceId}-${text(value.sourceType) ?? "unknown"}`,
    deviceId,
    message: text(value.message) ?? text(value.subject) ?? "Alarm ohne Nachricht",
    subject: text(value.subject) ?? text(value.sourceName) ?? sourceType,
    sourceType,
    sourceConfigUid: text(value.sourceConfigUid),
    sourceName: text(value.sourceName) ?? sourceType,
    category: categoryForSourceType(sourceType),
    severity,
    ninjaPriority,
    createdAt: toMillis(value.createTime),
    updatedAt: toMillis(value.updateTime),
    acknowledged: booleanValue(data.acknowledged) ?? false,
    data,
    tags: device?.tags ?? [],
  };
}

function normalizeActivity(raw: unknown): Activity | undefined {
  const value = record(raw);
  const deviceId = numberValue(value.deviceId);
  if (!deviceId) return undefined;
  const sourceType = text(value.type) ?? text(value.activityType) ?? "CONDITION";
  const severity = validSeverity(value.severity) ?? deriveSeverity(sourceType);
  const priorityCandidate = text(value.priority)?.toUpperCase();
  const priority =
    priorityCandidate === "HIGH" || priorityCandidate === "MEDIUM" || priorityCandidate === "LOW" || priorityCandidate === "NONE"
      ? priorityCandidate
      : deriveNinjaPriority(severity);
  return {
    id: numberValue(value.id) ?? 0,
    deviceId,
    activityTime: toMillis(value.activityTime),
    type: text(value.type) ?? sourceType,
    activityType: text(value.activityType) ?? "CONDITION",
    severity,
    priority,
    status: text(value.status) ?? "UNKNOWN",
    sourceName: text(value.sourceName) ?? sourceType,
    sourceConfigUid: text(value.sourceConfigUid),
    seriesUid: text(value.seriesUid),
    message: text(value.message) ?? "",
  };
}

export function normalizeOrganization(raw: unknown): Organization {
  const value = record(raw);
  return {
    id: numberValue(value.id) ?? 0,
    name: text(value.name) ?? "Unbekannte Organisation",
    description: text(value.description),
    tags: array(value.tags).filter((tag): tag is string => typeof tag === "string"),
  };
}

export function normalizeLocation(raw: unknown): Location {
  const value = record(raw);
  return {
    id: numberValue(value.id) ?? 0,
    organizationId: numberValue(value.organizationId) ?? numberValue(record(value.organization).id) ?? 0,
    name: text(value.name) ?? "Unbekannter Standort",
    address: text(value.address),
    tags: array(value.tags).filter((tag): tag is string => typeof tag === "string"),
  };
}

export function normalizePolicy(raw: unknown): Policy {
  const value = record(raw);
  return {
    id: numberValue(value.id) ?? 0,
    parentPolicyId: numberValue(value.parentPolicyId) ?? null,
    name: text(value.name) ?? "Unbenannte Policy",
    description: text(value.description),
    nodeClass: text(value.nodeClass) ?? "UNKNOWN",
    nodeClassDefault: booleanValue(value.nodeClassDefault) ?? false,
    tags: array(value.tags).filter((tag): tag is string => typeof tag === "string"),
  };
}

export function normalizeHealth(raw: unknown): DeviceHealth[] {
  const value = record(raw);
  const rows = Array.isArray(raw) ? raw : array(value.results);
  return rows
    .map((entry) => {
      const row = record(entry);
      const deviceId = numberValue(row.deviceId);
      if (!deviceId) return undefined;
      const healthStatus = text(row.healthStatus)?.toUpperCase();
      return {
        deviceId,
        healthStatus:
          healthStatus === "HEALTHY" || healthStatus === "NEEDS_ATTENTION" || healthStatus === "UNHEALTHY"
            ? healthStatus
            : "UNKNOWN",
        offline: booleanValue(row.offline) ?? false,
        parentOffline: booleanValue(row.parentOffline) ?? false,
        alertCount: numberValue(row.alertCount) ?? 0,
      } satisfies DeviceHealth;
    })
    .filter((entry): entry is DeviceHealth => Boolean(entry));
}

function priorityFromActivity(activity: Activity): Condition["priority"] {
  if (activity.priority === "HIGH") return "P1";
  return DEFAULT_SEVERITY_MATRIX[activity.severity] ?? "P4";
}

export function buildConditionsFromActivities(
  activities: Activity[],
  deviceMap: Map<number, Device>,
  policyMap: Map<number, Policy>,
): Condition[] {
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    if (!activity.sourceConfigUid && !activity.sourceName) continue;
    if (activity.activityType !== "CONDITION" && !activity.sourceConfigUid) continue;
    const key = activity.sourceConfigUid ?? `${activity.sourceName}|${activity.type}`;
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }

  const conditions: Condition[] = [];
  for (const [key, group] of groups) {
    const latest = [...group].sort((a, b) => b.activityTime - a.activityTime)[0]!;
    const devices = group.map((activity) => deviceMap.get(activity.deviceId)).filter((device): device is Device => Boolean(device));
    const firstDevice = devices[0];
    const orgIds = new Set(devices.map((device) => device.organizationId));
    const locationIds = new Set(devices.map((device) => device.locationId));
    const scopeLevel = locationIds.size === 1 ? "location" : orgIds.size === 1 ? "organization" : "global";
    const nodeGroupCounts = new Map<string, number>();
    for (const device of devices) nodeGroupCounts.set(device.nodeGroup, (nodeGroupCounts.get(device.nodeGroup) ?? 0) + 1);
    const nodeGroup = ([...nodeGroupCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "server") as Condition["nodeGroup"];
    const severity = group.reduce<Severity>(
      (highest, activity) => (severityRank(activity.severity) > severityRank(highest) ? activity.severity : highest),
      "NONE",
    );
    const policyId = firstDevice?.policyId;
    const policy = policyId ? policyMap.get(policyId) : undefined;
    const tags = new Set<string>();
    for (const device of devices) for (const tag of device.tags) tags.add(tag);

    conditions.push({
      id: `activity:${key}`,
      name: latest.sourceName || latest.type,
      sourceType: latest.type,
      category: categoryForSourceType(latest.type),
      description:
        "Aus der NinjaOne-Aktivitätshistorie abgeleitet. Schwellwert, Dauer und Vererbung sind über die Public API nicht verfügbar.",
      organizationId: firstDevice?.organizationId,
      organizationName: firstDevice?.organizationName,
      locationId: scopeLevel === "location" ? firstDevice?.locationId : undefined,
      locationName: scopeLevel === "location" ? firstDevice?.locationName : undefined,
      scopeLevel,
      nodeGroup,
      nodeClasses: [...new Set(devices.map((device) => device.nodeClass))],
      policyId,
      policyName: policy?.name ?? firstDevice?.policyName ?? "Unbekannte Policy",
      parentPolicyId: policy?.parentPolicyId ?? null,
      inherited: false,
      enabled: true,
      severity,
      priority: priorityFromActivity({ ...latest, severity }),
      threshold: "—",
      duration: "—",
      interval: "—",
      lastTriggeredAt: latest.activityTime,
      triggerCount: group.length,
      source: "ninjaone-activity",
      tags: [...tags].slice(0, 8),
    });
  }

  return conditions.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name));
}

export function normalizeLiveSnapshot(bundle: RawNinjaBundle, meta: Omit<SnapshotMeta, "counts">): Snapshot {
  const devices = bundle.devices.map((entry, index) => normalizeDevice(entry, index));
  const deviceMap = new Map(devices.map((device) => [device.id, device]));
  const alerts = bundle.alerts.map((entry) => normalizeAlert(entry, deviceMap));
  const organizations = bundle.organizations.map(normalizeOrganization);
  const locations = bundle.locations.map(normalizeLocation);
  const policies = bundle.policies.map(normalizePolicy);
  const policyMap = new Map(policies.map((policy) => [policy.id, policy]));
  const activities = bundle.activities
    .map(normalizeActivity)
    .filter((activity): activity is Activity => Boolean(activity))
    .sort((a, b) => b.activityTime - a.activityTime);
  const conditions = buildConditionsFromActivities(activities, deviceMap, policyMap);
  const health = normalizeHealth(bundle.health);

  return {
    meta: {
      ...meta,
      counts: {
        devices: devices.length,
        alerts: alerts.length,
        conditions: conditions.length,
        organizations: organizations.length,
        locations: locations.length,
      },
    },
    organizations,
    locations,
    policies,
    devices,
    alerts,
    conditions,
    activities,
    health,
  };
}
