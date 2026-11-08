import {
  DEFAULT_SEVERITY_MATRIX,
  PRIORITY_WEIGHT,
  bumpPriority,
  isSecuritySource,
  priorityRank,
  severityRank,
} from "./constants";
import type {
  Alert,
  Device,
  Priority,
  PriorityResult,
  PriorityRule,
  Settings,
} from "./types";

export interface PriorityContext {
  alert: Alert;
  device?: Device;
  settings: Pick<Settings, "severityMatrix" | "suppressionThreshold">;
  rules: PriorityRule[];
  now?: number;
}

function matchesRule(rule: PriorityRule, alert: Alert, device: Device | undefined, now: number): boolean {
  const match = rule.match;
  if (match.severity && !match.severity.includes(alert.severity)) return false;
  if (match.categories && !match.categories.includes(alert.category)) return false;
  if (match.nodeGroups && (!device || !match.nodeGroups.includes(device.nodeGroup))) return false;
  if (typeof match.offline === "boolean" && (!device || device.offline !== match.offline)) return false;

  if (match.sourceTypes && !match.sourceTypes.includes(alert.sourceType)) {
    if (!match.sourceTypePrefixes?.some((prefix) => alert.sourceType.startsWith(prefix))) return false;
  }
  if (match.sourceTypePrefixes && !match.sourceTypePrefixes.some((prefix) => alert.sourceType.startsWith(prefix))) {
    if (!match.sourceTypes?.includes(alert.sourceType)) return false;
  }

  if (match.olderThanMinutes !== undefined) {
    const ageMinutes = (now - alert.createdAt) / 60_000;
    if (ageMinutes < match.olderThanMinutes) return false;
  }

  if (match.tags && match.tags.length > 0) {
    const haystack = new Set([...(alert.tags ?? []), ...(device?.tags ?? [])]);
    if (!match.tags.some((tag) => haystack.has(tag))) return false;
  }

  if (match.dataNumberBelow) {
    for (const [key, threshold] of Object.entries(match.dataNumberBelow)) {
      const raw = alert.data?.[key];
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value) || value >= threshold) return false;
    }
  }

  return true;
}

export function computePriority(context: PriorityContext): PriorityResult {
  const { alert, device, rules } = context;
  const now = context.now ?? Date.now();
  const matrix = context.settings.severityMatrix ?? DEFAULT_SEVERITY_MATRIX;
  const basePriority: Priority = matrix[alert.severity] ?? "P4";
  const reasons: string[] = [`Severity ${alert.severity} → ${basePriority}`];
  let priority = basePriority;

  if (device?.maintenance && !isSecuritySource(alert.sourceType)) {
    priority = "P4";
    reasons.push("Gerät im Wartungsfenster → P4 (Sicherheitsalarme ausgenommen)");
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matchesRule(rule, alert, device, now)) continue;
    if (priorityRank(rule.priority) < priorityRank(priority)) {
      priority = rule.priority;
      reasons.push(`${rule.name} → ${rule.priority}`);
    }
  }

  if (alert.flapping) {
    priority = bumpPriority(priority, 1);
    reasons.push("Flapping erkannt → eine Stufe herabgesetzt");
  }

  if (alert.priorityOverride) {
    priority = alert.priorityOverride;
    reasons.push(`Manueller Override → ${priority}`);
  }

  const ageMinutes = Math.max(0, (now - alert.createdAt) / 60_000);
  const score =
    PRIORITY_WEIGHT[priority] +
    ageMinutes * 0.25 +
    severityRank(alert.severity) * 8 +
    (device?.offline ? 35 : 0) +
    (alert.flapping ? -25 : 0) +
    (alert.priorityOverride ? 500 : 0);

  return {
    priority,
    basePriority,
    score,
    reasons,
    overridden: Boolean(alert.priorityOverride),
  };
}

export interface ScoredAlert {
  alert: Alert;
  device?: Device;
  priority: Priority;
  score: number;
  reasons: string[];
  basePriority: Priority;
  overridden: boolean;
}

export function scoreAlerts(
  alerts: Alert[],
  devices: Device[],
  settings: Pick<Settings, "severityMatrix" | "suppressionThreshold">,
  rules: PriorityRule[],
  now = Date.now(),
): ScoredAlert[] {
  const deviceMap = new Map(devices.map((device) => [device.id, device]));
  return alerts.map((alert) => {
    const device = deviceMap.get(alert.deviceId);
    const result = computePriority({ alert, device, settings, rules, now });
    return {
      alert,
      device,
      priority: result.priority,
      score: result.score,
      reasons: result.reasons,
      basePriority: result.basePriority,
      overridden: result.overridden,
    };
  });
}

export function sortScoredAlerts(a: ScoredAlert, b: ScoredAlert): number {
  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;
  if (a.score !== b.score) return b.score - a.score;
  return a.alert.createdAt - b.alert.createdAt;
}

export function countByPriority(alerts: Array<{ priority: Priority }>): Record<Priority, number> {
  const result: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const alert of alerts) result[alert.priority] += 1;
  return result;
}
