import {
  Activity,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  Clock,
  Filter,
  Layers,
  ListTree,
  MapPin,
  Network,
  RotateCcw,
  Search,
  Server,
  SlidersHorizontal,
  Table2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CATEGORY_LABEL,
  NODE_GROUP_LABEL,
  SEVERITY_LABEL,
  priorityRank,
  severityRank,
} from "../../shared/constants";
import type { Condition, ConditionCategory, NodeGroup, Severity } from "../../shared/types";
import { useApp, type AlertView } from "../context/AppContext";
import { cn } from "../lib/cn";
import { matchesQuery } from "../lib/filters";
import { formatNumber, formatRelative } from "../lib/format";
import { useSavedViews } from "../lib/useSavedViews";
import { PageHeader } from "../components/PageHeader";
import { AlertRow } from "../components/alerts/AlertRow";
import { Drawer } from "../components/ui/Overlay";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PriorityBadge,
  SearchInput,
  Segmented,
  Select,
  SeverityBadge,
  NodeGroupBadge,
} from "../components/ui/Primitives";
import { SavedViews } from "../components/ui/SavedViews";

type GroupBy = "hierarchy" | "organization" | "location" | "nodeGroup" | "category" | "policy" | "severity";
type SortKey = "priority" | "name" | "lastTriggered" | "triggers" | "policy" | "severity";
type ViewMode = "hierarchy" | "table";

interface Filters {
  organization: string;
  location: string;
  nodeGroup: string;
  category: string;
  severity: string;
  status: string;
  policy: string;
}

const EMPTY_FILTERS: Filters = {
  organization: "",
  location: "",
  nodeGroup: "",
  category: "",
  severity: "",
  status: "",
  policy: "",
};

interface GroupNode {
  key: string;
  label: string;
  icon: LucideIcon;
  count: number;
  meta?: string;
  children?: GroupNode[];
  items?: Condition[];
}

const GROUP_ICON: Record<string, LucideIcon> = {
  organization: Building2,
  location: MapPin,
  nodeGroup: Layers,
  category: SlidersHorizontal,
  policy: ListTree,
  severity: Filter,
};

function conditionMatches(
  condition: Condition,
  query: string,
  filters: Filters,
  organizationName: string | undefined,
  locationName: string | undefined,
  selectedLocation: { id: number; organizationId: number } | undefined,
): boolean {
  if (
    query &&
    !matchesQuery(
      query,
      condition.name,
      condition.description,
      condition.sourceType,
      condition.policyName,
      organizationName,
      locationName,
      condition.tags.join(" "),
    )
  ) {
    return false;
  }
  if (filters.organization) {
    if (condition.scopeLevel !== "global" && String(condition.organizationId ?? "") !== filters.organization) return false;
  }
  if (filters.location && selectedLocation) {
    if (condition.scopeLevel === "location" && condition.locationId !== selectedLocation.id) return false;
    if (condition.scopeLevel === "organization" && condition.organizationId !== selectedLocation.organizationId) return false;
  }
  if (filters.nodeGroup && condition.nodeGroup !== filters.nodeGroup) return false;
  if (filters.category && condition.category !== filters.category) return false;
  if (filters.severity && condition.severity !== filters.severity) return false;
  if (filters.policy && String(condition.policyId ?? "") !== filters.policy) return false;
  if (filters.status === "enabled" && !condition.enabled) return false;
  if (filters.status === "disabled" && condition.enabled) return false;
  if (filters.status === "triggered" && !condition.lastTriggeredAt) return false;
  if (filters.status === "critical" && condition.severity !== "CRITICAL") return false;
  return true;
}

function sortConditions(items: Condition[], sort: SortKey): Condition[] {
  const copy = [...items];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "de"));
    case "lastTriggered":
      return copy.sort((a, b) => (b.lastTriggeredAt ?? 0) - (a.lastTriggeredAt ?? 0));
    case "triggers":
      return copy.sort((a, b) => b.triggerCount - a.triggerCount);
    case "policy":
      return copy.sort((a, b) => a.policyName.localeCompare(b.policyName, "de"));
    case "severity":
      return copy.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    case "priority":
    default:
      return copy.sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          severityRank(b.severity) - severityRank(a.severity) ||
          a.name.localeCompare(b.name, "de"),
      );
  }
}

function buildHierarchy(items: Condition[]): GroupNode[] {
  const organizations = new Map<string, Condition[]>();
  for (const condition of items) {
    const key = condition.organizationId ? `org:${condition.organizationId}` : "org:global";
    const list = organizations.get(key) ?? [];
    list.push(condition);
    organizations.set(key, list);
  }
  return [...organizations.entries()]
    .map(([orgKey, orgItems]) => {
      const first = orgItems[0]!;
      const locations = new Map<string, Condition[]>();
      for (const condition of orgItems) {
        const key = condition.locationId ? `loc:${condition.locationId}` : "loc:all";
        const list = locations.get(key) ?? [];
        list.push(condition);
        locations.set(key, list);
      }
      const children = [...locations.entries()].map(([locationKey, locationItems]) => {
        const nodeGroups = new Map<string, Condition[]>();
        for (const condition of locationItems) {
          const list = nodeGroups.get(condition.nodeGroup) ?? [];
          list.push(condition);
          nodeGroups.set(condition.nodeGroup, list);
        }
        return {
          key: locationKey,
          label: locationItems[0]?.locationName ?? "Alle Standorte",
          icon: MapPin,
          count: locationItems.length,
          children: [...nodeGroups.entries()]
            .map(([nodeGroup, groupItems]) => ({
              key: `${locationKey}:${nodeGroup}`,
              label: NODE_GROUP_LABEL[nodeGroup as NodeGroup] ?? nodeGroup,
              icon: nodeGroup === "network" ? Network : nodeGroup === "server" ? Server : Layers,
              count: groupItems.length,
              items: groupItems,
            }))
            .sort((a, b) => b.count - a.count),
        };
      });
      return {
        key: orgKey,
        label: first.organizationName ?? "Global · alle Organisationen",
        icon: Building2,
        count: orgItems.length,
        meta: first.organizationId ? undefined : "gilt mandantenübergreifend",
        children,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function buildFlatGroups(items: Condition[], groupBy: Exclude<GroupBy, "hierarchy">): GroupNode[] {
  const map = new Map<string, Condition[]>();
  for (const condition of items) {
    let key = "";
    switch (groupBy) {
      case "organization":
        key = condition.organizationName ?? "Global";
        break;
      case "location":
        key = condition.locationName ?? "Alle Standorte";
        break;
      case "nodeGroup":
        key = NODE_GROUP_LABEL[condition.nodeGroup];
        break;
      case "category":
        key = CATEGORY_LABEL[condition.category];
        break;
      case "policy":
        key = condition.policyName;
        break;
      case "severity":
        key = SEVERITY_LABEL[condition.severity];
        break;
    }
    const list = map.get(key) ?? [];
    list.push(condition);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([label, groupItems]) => ({
      key: `${groupBy}:${label}`,
      label,
      icon: GROUP_ICON[groupBy] ?? Layers,
      count: groupItems.length,
      items: groupItems,
    }))
    .sort((a, b) => b.count - a.count);
}

function TreeGroup({
  node,
  depth,
  collapsed,
  onToggle,
  onOpen,
  onShowAlerts,
}: {
  node: GroupNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  onOpen: (condition: Condition) => void;
  onShowAlerts: (condition: Condition) => void;
}) {
  const isCollapsed = collapsed.has(node.key);
  const Icon = node.icon;
  const critical = node.items?.filter((item) => item.severity === "CRITICAL").length ?? 0;
  const disabled = node.items?.filter((item) => !item.enabled).length ?? 0;
  return (
    <div className={cn("tree-group", `tree-group--depth-${depth}`)}>
      <button type="button" className="tree-group__header" onClick={() => onToggle(node.key)} aria-expanded={!isCollapsed}>
        <span className="tree-group__chevron">{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
        <span className={cn("tree-group__icon", `tree-group__icon--${depth}`)}>
          <Icon size={14} aria-hidden />
        </span>
        <span className="tree-group__label">{node.label}</span>
        {node.meta ? <span className="tree-group__meta">{node.meta}</span> : null}
        <span className="tree-group__spacer" />
        {critical > 0 ? <Badge tone="danger">{critical} kritisch</Badge> : null}
        {disabled > 0 ? <Badge tone="neutral">{disabled} aus</Badge> : null}
        <span className="tree-group__count">{node.count}</span>
      </button>
      {!isCollapsed ? (
        <div className="tree-group__body">
          {node.children
            ? node.children.map((child) => (
                <TreeGroup
                  key={child.key}
                  node={child}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onOpen={onOpen}
                  onShowAlerts={onShowAlerts}
                />
              ))
            : (node.items ?? []).map((condition) => (
                <ConditionRow key={condition.id} condition={condition} onOpen={onOpen} onShowAlerts={onShowAlerts} />
              ))}
        </div>
      ) : null}
    </div>
  );
}

function ConditionRow({
  condition,
  onOpen,
  onShowAlerts,
}: {
  condition: Condition;
  onOpen: (condition: Condition) => void;
  onShowAlerts: (condition: Condition) => void;
}) {
  return (
    <article className={cn("condition-row", !condition.enabled && "is-disabled")} onClick={() => onOpen(condition)}>
      <div className="condition-row__main">
        <div className="condition-row__title-line">
          <span className="condition-row__name">{condition.name}</span>
          <SeverityBadge severity={condition.severity} />
          <Badge tone="neutral">{CATEGORY_LABEL[condition.category]}</Badge>
          {!condition.enabled ? <Badge tone="neutral">Deaktiviert</Badge> : null}
          {condition.inherited ? <Badge tone="violet">vererbt</Badge> : null}
        </div>
        <p className="condition-row__description">{condition.description}</p>
        <div className="condition-row__meta">
          <span className="condition-row__source">{condition.sourceType}</span>
          <span>{condition.policyName}</span>
          <span className="condition-row__threshold">
            Schwelle <strong>{condition.threshold}</strong>
          </span>
          <span>
            Dauer <strong>{condition.duration}</strong>
          </span>
          <span>
            <Clock size={11} aria-hidden /> {condition.lastTriggeredAt ? formatRelative(condition.lastTriggeredAt) : "nie"}
          </span>
          <span>{condition.triggerCount} Trigger</span>
        </div>
      </div>
      <div className="condition-row__side">
        <PriorityBadge priority={condition.priority} compact />
        <span className={cn("condition-status", condition.enabled ? "is-on" : "is-off")}>
          <span className="status-dot" />
          {condition.enabled ? "Aktiv" : "Aus"}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Alarme für ${condition.name} anzeigen`}
          onClick={(event) => {
            event.stopPropagation();
            onShowAlerts(condition);
          }}
        >
          <Activity size={15} />
        </button>
        <ChevronRight size={16} className="condition-row__chevron" />
      </div>
    </article>
  );
}

function ConditionTable({
  conditions,
  sort,
  onSort,
  onOpen,
}: {
  conditions: Condition[];
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  onOpen: (condition: Condition) => void;
}) {
  const header = (key: SortKey, label: string) => (
    <th aria-sort={sort === key ? "ascending" : "none"}>
      <button type="button" onClick={() => onSort(key)}>
        {label}
        {sort === key ? <ChevronDown size={11} /> : null}
      </button>
    </th>
  );
  return (
    <div className="table-wrap">
      <table className="data-table condition-table">
        <thead>
          <tr>
            {header("name", "Bedingung")}
            <th>Geltungsbereich</th>
            {header("policy", "Policy")}
            <th>Kategorie</th>
            {header("severity", "Severity")}
            {header("priority", "Priorität")}
            <th>Schwelle</th>
            {header("lastTriggered", "Letzter Trigger")}
            {header("triggers", "Trigger")}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((condition) => (
            <tr key={condition.id} onClick={() => onOpen(condition)}>
              <td>
                <div className="cell-main">
                  <strong>{condition.name}</strong>
                  <span>{condition.sourceType}</span>
                </div>
              </td>
              <td>
                <div className="cell-main">
                  <strong>{condition.organizationName ?? "Global"}</strong>
                  <span>{condition.locationName ?? "Alle Standorte"}</span>
                </div>
              </td>
              <td>{condition.policyName}</td>
              <td>{CATEGORY_LABEL[condition.category]}</td>
              <td>
                <SeverityBadge severity={condition.severity} />
              </td>
              <td>
                <PriorityBadge priority={condition.priority} compact />
              </td>
              <td className="cell-mono">{condition.threshold}</td>
              <td>{condition.lastTriggeredAt ? formatRelative(condition.lastTriggeredAt) : "—"}</td>
              <td>{condition.triggerCount}</td>
              <td>
                <span className={cn("condition-status", condition.enabled ? "is-on" : "is-off")}>
                  <span className="status-dot" />
                  {condition.enabled ? "Aktiv" : "Aus"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConditionDrawer({
  condition,
  relatedAlerts,
  onClose,
  onShowAlerts,
  onOpenAlert,
  onCreateTask,
}: {
  condition: Condition;
  relatedAlerts: AlertView[];
  onClose: () => void;
  onShowAlerts: () => void;
  onOpenAlert: (view: AlertView) => void;
  onCreateTask: () => void;
}) {
  return (
    <Drawer
      open
      onClose={onClose}
      width="wide"
      title={condition.name}
      subtitle={`${condition.sourceType} · ${condition.policyName}`}
      headerExtra={<PriorityBadge priority={condition.priority} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Schließen
          </Button>
          <Button variant="secondary" icon={ClipboardPlus} onClick={onCreateTask}>
            Aufgabe anlegen
          </Button>
          <Button variant="primary" icon={Activity} onClick={onShowAlerts}>
            Alarme anzeigen
          </Button>
        </>
      }
    >
      <div className="detail-badges">
        <SeverityBadge severity={condition.severity} />
        <Badge tone="neutral">{CATEGORY_LABEL[condition.category]}</Badge>
        <NodeGroupBadge group={condition.nodeGroup} />
        <Badge tone={condition.enabled ? "success" : "neutral"} dot>
          {condition.enabled ? "Aktiv" : "Deaktiviert"}
        </Badge>
        {condition.inherited ? <Badge tone="violet">vererbt</Badge> : null}
        <Badge tone={condition.source === "ninjaone-activity" ? "info" : "neutral"}>
          {condition.source === "ninjaone-activity" ? "NinjaOne-Aktivität" : "Lokaler Katalog"}
        </Badge>
      </div>

      <p className="detail-message">{condition.description}</p>

      <div className="detail-grid">
        <div>
          <span>Geltungsbereich</span>
          <strong>{condition.organizationName ?? "Global"}</strong>
          <small>{condition.locationName ?? "Alle Standorte"}</small>
        </div>
        <div>
          <span>Policy</span>
          <strong>{condition.policyName}</strong>
          <small>{condition.parentPolicyId ? `Parent-Policy ${condition.parentPolicyId}` : "Keine Parent-Policy"}</small>
        </div>
        <div>
          <span>Schwelle</span>
          <strong>{condition.threshold}</strong>
          <small>Dauer {condition.duration}</small>
        </div>
        <div>
          <span>Intervall</span>
          <strong>{condition.interval}</strong>
          <small>Auswertung durch NinjaOne</small>
        </div>
        <div>
          <span>Letzter Trigger</span>
          <strong>{condition.lastTriggeredAt ? formatRelative(condition.lastTriggeredAt) : "Nie"}</strong>
          <small>{condition.lastTriggeredAt ? new Date(condition.lastTriggeredAt).toLocaleString("de-DE") : "Keine Aktivität"}</small>
        </div>
        <div>
          <span>Trigger gesamt</span>
          <strong>{formatNumber(condition.triggerCount)}</strong>
          <small>aus der Aktivitätshistorie</small>
        </div>
      </div>

      <section className="detail-section">
        <h3>Geräteklassen</h3>
        <div className="detail-tags">
          {condition.nodeClasses.map((nodeClass) => (
            <span className="device-chip" key={nodeClass}>
              {nodeClass}
            </span>
          ))}
          {condition.nodeClasses.length === 0 ? <span className="muted">Keine Einschränkung</span> : null}
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Ausgelöste Alarme</h3>
          <Badge tone="neutral">{relatedAlerts.length}</Badge>
        </div>
        {relatedAlerts.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="Keine aktiven Alarme" description="Diese Bedingung ist aktuell nicht ausgelöst." />
        ) : (
          <div className="alert-list detail-alert-list">
            {relatedAlerts.slice(0, 5).map((view) => (
              <AlertRow
                key={view.alert.uid}
                view={view}
                compact
                onOpen={onOpenAlert}
                onTask={() => undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="info-box">
          <Search size={16} aria-hidden />
          <div>
            <strong>Woher kommen diese Daten?</strong>
            <p>
              Die NinjaOne Public API liefert Condition-Rohkonfigurationen nicht über <code>/v2/policies</code>. Signal
              kombiniert Aktivitäten (<code>sourceConfigUid</code>, <code>sourceName</code>) mit dem lokal gepflegten
              Katalog. Schwellwert und Dauer sind im Demo-Katalog vollständig; im Live-Modus werden sie als „—“
              gekennzeichnet, wenn sie nicht verfügbar sind.
            </p>
          </div>
        </div>
      </section>
    </Drawer>
  );
}

export function Conditions() {
  const { conditions, alertViews, organizationMap, locationMap, createTask } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [groupBy, setGroupBy] = useState<GroupBy>("hierarchy");
  const [view, setView] = useState<ViewMode>("hierarchy");
  const [sort, setSort] = useState<SortKey>("priority");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { views, save, remove } = useSavedViews("conditions");
  const selectedId = searchParams.get("condition");
  const selected = conditions.find((condition) => condition.id === selectedId);

  const organizations = useMemo(() => [...organizationMap.values()].sort((a, b) => a.name.localeCompare(b.name, "de")), [organizationMap]);
  const locations = useMemo(
    () =>
      [...locationMap.values()]
        .filter((location) => !filters.organization || String(location.organizationId) === filters.organization)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [locationMap, filters.organization],
  );
  const policies = useMemo(
    () => [...new Map(conditions.filter((condition) => condition.policyId).map((condition) => [condition.policyId, condition.policyName])).entries()],
    [conditions],
  );

  const selectedLocation = filters.location ? locationMap.get(Number(filters.location)) : undefined;
  const filtered = useMemo(
    () =>
      sortConditions(
        conditions.filter((condition) =>
          conditionMatches(condition, query, filters, condition.organizationName, condition.locationName, selectedLocation),
        ),
        sort,
      ),
    [conditions, query, filters, sort, selectedLocation],
  );

  const hierarchy = useMemo(() => buildHierarchy(filtered), [filtered]);
  const flatGroups = useMemo(
    () => (groupBy === "hierarchy" ? [] : buildFlatGroups(filtered, groupBy)),
    [filtered, groupBy],
  );

  const activeCount = conditions.filter((condition) => condition.enabled).length;
  const triggeredCount = conditions.filter((condition) => condition.lastTriggeredAt).length;
  const criticalCount = conditions.filter((condition) => condition.severity === "CRITICAL").length;
  const disabledCount = conditions.filter((condition) => !condition.enabled).length;

  const relatedAlerts = useMemo(
    () =>
      selected
        ? alertViews
            .filter(
              (view) =>
                view.alert.sourceType === selected.sourceType ||
                view.alert.sourceName === selected.name ||
                view.alert.sourceConfigUid === selected.id,
            )
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
        : [],
    [alertViews, selected],
  );

  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("condition", id);
    else next.delete("condition");
    setSearchParams(next, { replace: true });
  };

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "organization" ? { location: "" } : {}) }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  };

  const hasFilters = Boolean(query) || Object.values(filters).some(Boolean);
  const activeFilters = [
    query ? { key: "query", label: `Suche: ${query}` } : null,
    filters.organization ? { key: "organization", label: organizations.find((org) => String(org.id) === filters.organization)?.name ?? filters.organization } : null,
    filters.location ? { key: "location", label: locations.find((loc) => String(loc.id) === filters.location)?.name ?? filters.location } : null,
    filters.nodeGroup ? { key: "nodeGroup", label: NODE_GROUP_LABEL[filters.nodeGroup as NodeGroup] } : null,
    filters.category ? { key: "category", label: CATEGORY_LABEL[filters.category as ConditionCategory] } : null,
    filters.severity ? { key: "severity", label: SEVERITY_LABEL[filters.severity as Severity] } : null,
    filters.status ? { key: "status", label: filters.status === "enabled" ? "Aktiv" : filters.status === "disabled" ? "Deaktiviert" : filters.status === "triggered" ? "Ausgelöst" : "Kritisch" } : null,
    filters.policy ? { key: "policy", label: policies.find(([id]) => String(id) === filters.policy)?.[1] ?? filters.policy } : null,
  ].filter((entry): entry is { key: string; label: string } => Boolean(entry));

  const removeFilter = (key: string) => {
    if (key === "query") setQuery("");
    else setFilter(key as keyof Filters, "");
  };

  const applyView = (saved: (typeof views)[number]) => {
    setQuery(saved.query);
    setFilters({ ...EMPTY_FILTERS, ...Object.fromEntries(Object.entries(saved.filters).map(([key, values]) => [key, values[0] ?? ""])) });
    setSort((saved.sort as SortKey) || "priority");
    setGroupBy((saved.groupBy as GroupBy) || "hierarchy");
  };

  const saveView = (name: string) => {
    save({
      name,
      query,
      filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, [value]])),
      sort,
      groupBy,
    });
  };

  return (
    <div className="page conditions-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <ListTree size={13} aria-hidden />
            {conditions.length} Bedingungen aus {new Set(conditions.map((condition) => condition.policyName)).size} Policies
          </span>
        }
        title="Bedingungen"
        description="Alle bekannten Conditions, mehrstufig nach Organisation, Standort und Geräteklasse gruppiert – mit Schwellwerten, Policies und Trigger-Historie."
        actions={
          <>
            <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setFiltersOpen((open) => !open)}>
              Filter {hasFilters ? `(${activeFilters.length})` : ""}
            </Button>
            <Button variant="primary" icon={Activity} onClick={() => navigate("/alerts")}>
              Alarme öffnen
            </Button>
          </>
        }
      />

      <div className="stat-strip">
        <button type="button" className={cn("stat-strip__item", !filters.status && "is-active")} onClick={() => setFilter("status", "")}>
          <span className="stat-strip__value">{formatNumber(conditions.length)}</span>
          <span className="stat-strip__label">Gesamt</span>
        </button>
        <button type="button" className={cn("stat-strip__item", filters.status === "enabled" && "is-active")} onClick={() => setFilter("status", "enabled")}>
          <span className="stat-strip__value stat-strip__value--success">{activeCount}</span>
          <span className="stat-strip__label">Aktiv</span>
        </button>
        <button type="button" className={cn("stat-strip__item", filters.status === "triggered" && "is-active")} onClick={() => setFilter("status", "triggered")}>
          <span className="stat-strip__value stat-strip__value--warning">{triggeredCount}</span>
          <span className="stat-strip__label">Ausgelöst</span>
        </button>
        <button type="button" className={cn("stat-strip__item", filters.status === "critical" && "is-active")} onClick={() => setFilter("status", "critical")}>
          <span className="stat-strip__value stat-strip__value--danger">{criticalCount}</span>
          <span className="stat-strip__label">Kritisch</span>
        </button>
        <button type="button" className={cn("stat-strip__item", filters.status === "disabled" && "is-active")} onClick={() => setFilter("status", "disabled")}>
          <span className="stat-strip__value">{disabledCount}</span>
          <span className="stat-strip__label">Deaktiviert</span>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchInput
            className="toolbar__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bedingung, Policy, Standort oder Source-Type suchen …"
            aria-label="Bedingungen durchsuchen"
          />
          <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)} aria-label="Gruppierung">
            <option value="hierarchy">Hierarchie (Org → Standort → Klasse)</option>
            <option value="organization">Nach Organisation</option>
            <option value="location">Nach Standort</option>
            <option value="nodeGroup">Nach Geräteklasse</option>
            <option value="category">Nach Kategorie</option>
            <option value="policy">Nach Policy</option>
            <option value="severity">Nach Severity</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sortierung">
            <option value="priority">Priorität</option>
            <option value="severity">Severity</option>
            <option value="name">Name</option>
            <option value="lastTriggered">Letzter Trigger</option>
            <option value="triggers">Trigger-Anzahl</option>
            <option value="policy">Policy</option>
          </Select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "hierarchy", label: "Gruppiert", icon: ListTree },
              { value: "table", label: "Tabelle", icon: Table2 },
            ]}
            ariaLabel="Ansicht"
          />
          <SavedViews views={views} onApply={applyView} onSave={saveView} onRemove={remove} />
        </div>

        {filtersOpen ? (
          <div className="toolbar__filters">
            <Select value={filters.organization} onChange={(event) => setFilter("organization", event.target.value)} aria-label="Organisation">
              <option value="">Alle Organisationen</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
            <Select value={filters.location} onChange={(event) => setFilter("location", event.target.value)} aria-label="Standort">
              <option value="">Alle Standorte</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
            <Select value={filters.nodeGroup} onChange={(event) => setFilter("nodeGroup", event.target.value)} aria-label="Geräteklasse">
              <option value="">Alle Geräteklassen</option>
              {Object.entries(NODE_GROUP_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={filters.category} onChange={(event) => setFilter("category", event.target.value)} aria-label="Kategorie">
              <option value="">Alle Kategorien</option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={filters.severity} onChange={(event) => setFilter("severity", event.target.value)} aria-label="Severity">
              <option value="">Alle Severities</option>
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} aria-label="Status">
              <option value="">Alle Status</option>
              <option value="enabled">Aktiv</option>
              <option value="disabled">Deaktiviert</option>
              <option value="triggered">Ausgelöst</option>
              <option value="critical">Kritisch</option>
            </Select>
            <Select value={filters.policy} onChange={(event) => setFilter("policy", event.target.value)} aria-label="Policy">
              <option value="">Alle Policies</option>
              {policies.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {activeFilters.length > 0 ? (
          <div className="active-filters">
            {activeFilters.map((filter) => (
              <span className="active-filter" key={filter.key}>
                {filter.label}
                <button type="button" onClick={() => removeFilter(filter.key)} aria-label={`Filter ${filter.label} entfernen`}>
                  <X size={11} />
                </button>
              </span>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
              <RotateCcw size={13} /> Zurücksetzen
            </button>
          </div>
        ) : null}

        <div className="toolbar__meta">
          <span>
            <strong>{filtered.length}</strong> von {conditions.length} Bedingungen
          </span>
          <span className="dot-sep">·</span>
          <span>{view === "table" ? "Tabellenansicht" : groupBy === "hierarchy" ? "3-stufige Hierarchie" : "Gruppierte Ansicht"}</span>
          {hasFilters ? (
            <button type="button" className="text-link" onClick={resetFilters}>
              Filter zurücksetzen
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Search}
            title="Keine Bedingungen gefunden"
            description="Für diese Kombination aus Suche und Filtern gibt es keine Treffer."
            action={
              <Button variant="secondary" icon={RotateCcw} onClick={resetFilters}>
                Filter zurücksetzen
              </Button>
            }
          />
        </Panel>
      ) : view === "table" ? (
        <Panel>
          <ConditionTable conditions={filtered} sort={sort} onSort={setSort} onOpen={(condition) => setSelected(condition.id)} />
        </Panel>
      ) : groupBy === "hierarchy" ? (
        <Panel className="condition-tree">
          {hierarchy.map((node) => (
            <TreeGroup
              key={node.key}
              node={node}
              depth={0}
              collapsed={collapsed}
              onToggle={(key) =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              onOpen={(condition) => setSelected(condition.id)}
              onShowAlerts={(condition) => navigate(`/alerts?condition=${encodeURIComponent(condition.id)}`)}
            />
          ))}
        </Panel>
      ) : (
        <div className="flat-groups">
          {flatGroups.map((node) => (
            <Panel className="flat-group" key={node.key}>
              <div className="flat-group__header">
                <node.icon size={16} aria-hidden />
                <h2>{node.label}</h2>
                <Badge tone="neutral">{node.count}</Badge>
              </div>
              <div>
                {(node.items ?? []).map((condition) => (
                  <ConditionRow
                    key={condition.id}
                    condition={condition}
                    onOpen={(entry) => setSelected(entry.id)}
                    onShowAlerts={(entry) => navigate(`/alerts?condition=${encodeURIComponent(entry.id)}`)}
                  />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {selected ? (
        <ConditionDrawer
          condition={selected}
          relatedAlerts={relatedAlerts}
          onClose={() => setSelected(null)}
          onShowAlerts={() => navigate(`/alerts?condition=${encodeURIComponent(selected.id)}`)}
          onOpenAlert={(view) => navigate(`/alerts?alert=${encodeURIComponent(view.alert.uid)}`)}
          onCreateTask={() =>
            void createTask({
              title: `Bedingung prüfen: ${selected.name}`,
              description: `Bedingung ${selected.name} (${selected.sourceType}) in Policy ${selected.policyName} prüfen.`,
              priority: selected.priority,
              tags: ["condition", selected.category],
              deviceIds: [],
            })
          }
        />
      ) : null}
    </div>
  );
}
