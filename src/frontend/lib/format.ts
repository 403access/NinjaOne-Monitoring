const RELATIVE_UNITS: Array<{ limit: number; divisor: number; suffix: string }> = [
  { limit: 60_000, divisor: 1_000, suffix: "s" },
  { limit: 3_600_000, divisor: 60_000, suffix: "min" },
  { limit: 86_400_000, divisor: 3_600_000, suffix: "h" },
  { limit: 604_800_000, divisor: 86_400_000, suffix: "T" },
];

export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp;
  const future = diff < 0;
  const absolute = Math.abs(diff);
  if (absolute < 15_000) return "gerade eben";
  for (const unit of RELATIVE_UNITS) {
    if (absolute < unit.limit) {
      const value = Math.max(1, Math.round(absolute / unit.divisor));
      return future ? `in ${value} ${unit.suffix}` : `vor ${value} ${unit.suffix}`;
    }
  }
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(timestamp);
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(timestamp);
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits }).format(value);
}

export function ageMinutes(timestamp: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - timestamp) / 60_000));
}

export function toLocalInput(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(count: number, singular: string, pluralForm = `${singular}e`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function shortUid(uid: string, length = 8): string {
  return uid.length > length ? uid.slice(0, length) : uid;
}

export function confidenceLabel(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function dueLabel(timestamp?: number): { label: string; tone: "neutral" | "warning" | "danger" | "success" } {
  if (!timestamp) return { label: "Keine Frist", tone: "neutral" };
  const diff = timestamp - Date.now();
  if (diff < 0) return { label: `Überfällig · ${formatRelative(timestamp)}`, tone: "danger" };
  if (diff < 3_600_000) return { label: `Fällig ${formatRelative(timestamp)}`, tone: "warning" };
  if (diff < 86_400_000) return { label: `Fällig ${formatRelative(timestamp)}`, tone: "warning" };
  return { label: `Fällig ${formatDate(timestamp)}`, tone: "neutral" };
}

export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
