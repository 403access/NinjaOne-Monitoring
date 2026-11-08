export function normalize(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchesQuery(query: string, ...values: Array<string | number | undefined | null>): boolean {
  const needle = normalize(query.trim());
  if (!needle) return true;
  return values.some((value) => value !== undefined && value !== null && normalize(String(value)).includes(needle));
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function countBy<T, K extends string | number>(values: T[], key: (value: T) => K): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const value of values) {
    const group = key(value);
    result[group] = (result[group] ?? 0) + 1;
  }
  return result;
}

export function groupBy<T, K extends string>(values: T[], key: (value: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const value of values) {
    const group = key(value);
    const list = result.get(group) ?? [];
    list.push(value);
    result.set(group, list);
  }
  return result;
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function filterByQuery<T>(values: T[], query: string, selector: (value: T) => Array<string | number | undefined | null>): T[] {
  if (!query.trim()) return values;
  return values.filter((value) => matchesQuery(query, ...selector(value)));
}

export function sortBy<T>(values: T[], selector: (value: T) => string | number, direction: "asc" | "desc" = "asc"): T[] {
  return [...values].sort((a, b) => {
    const left = selector(a);
    const right = selector(b);
    if (left === right) return 0;
    const comparison = left < right ? -1 : 1;
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginate<T>(values: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page) * pageSize;
  return values.slice(start, start + pageSize);
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function facetCounts<T>(values: T[], selector: (value: T) => string | undefined): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = selector(value);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function includesAny(values: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((value) => values.includes(value));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
