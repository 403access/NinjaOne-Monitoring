import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  Eye,
  EyeOff,
  Filter,
  GitBranch,
  Inbox,
  Layers,
  RotateCcw,
  Siren,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CATEGORY_LABEL,
  NODE_GROUP_LABEL,
  PRIORITY_LABEL,
  SEVERITY_LABEL,
  priorityRank,
  severityRank,
} from "../../shared/constants";
import { sortScoredAlerts } from "../../shared/priority";
import type { Priority } from "../../shared/types";
import { useApp, type AlertView } from "../context/AppContext";
import { cn } from "../lib/cn";
import { matchesQuery, paginate, pageCount } from "../lib/filters";
import { useSavedViews } from "../lib/useSavedViews";
import { PageHeader } from "../components/PageHeader";
import { AlertDrawer } from "../components/alerts/AlertDrawer";
import { AlertRow } from "../components/alerts/AlertRow";
import { Modal } from "../components/ui/Overlay";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  Progress,
  SearchInput,
  Select,
  Toggle,
} from "../components/ui/Primitives";
import { SavedViews } from "../components/ui/SavedViews";

type SortKey = "priority" | "newest" | "oldest" | "device" | "source" | "severity";
type GroupBy = "none" | "priority" | "device" | "organization" | "location" | "category" | "source" | "incident";

interface Filters {
  severity: string;
  organization: string;
  location: string;
  nodeGroup: string;
  category: string;
  source: string;
  status: string;
  age: string;
}

const EMPTY_FILTERS: Filters = {
  severity: "",
  organization: "",
  location: "",
  nodeGroup: "",
  category: "",
  source: "",
  status: "",
  age: "",
};

const PAGE_SIZE = 25;

function sortAlerts(items: AlertView[], sort: SortKey): AlertView[] {
  const copy = [...items];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => b.alert.createdAt - a.alert.createdAt);
    case "oldest":
      return copy.sort((a, b) => a.alert.createdAt - b.alert.createdAt);
    case "device":
      return copy.sort((a, b) => (a.device?.displayName ?? "").localeCompare(b.device?.displayName ?? "", "de"));
    case "source":
      return copy.sort((a, b) => a.alert.sourceName.localeCompare(b.alert.sourceName, "de"));
    case "severity":
      return copy.sort((a, b) => severityRank(b.alert.severity) - severityRank(a.alert.severity));
    case "priority":
    default:
      return copy.sort(sortScoredAlerts);
  }
}

function groupAlerts(items: AlertView[], groupBy: Exclude<GroupBy, "none">): Array<{ key: string; label: string; items: AlertView[] }> {
  const map = new Map<string, { key: string; label: string; items: AlertView[] }>();
  for (const view of items) {
    let key = "";
    let label = "";
    switch (groupBy) {
      case "priority":
        key = view.priority;
        label = PRIORITY_LABEL[view.priority];
        break;
      case "device":
        key = String(view.alert.deviceId);
        label = view.device?.displayName ?? `Gerät ${view.alert.deviceId}`;
        break;
      case "organization":
        key = String(view.device?.organizationId ?? "unknown");
        label = view.device?.organizationName ?? "Unbekannte Organisation";
        break;
      case "location":
        key = String(view.device?.locationId ?? "unknown");
        label = view.device?.locationName ?? "Unbekannter Standort";
        break;
      case "category":
        key = view.alert.category;
        label = CATEGORY_LABEL[view.alert.category];
        break;
      case "source":
        key = view.alert.sourceName;
        label = view.alert.sourceName;
        break;
      case "incident":
        key = view.incident?.id ?? "standalone";
        label = view.incident?.title ?? "Ohne Incident";
        break;
    }
    const group = map.get(key) ?? { key, label, items: [] };
    group.items.push(view);
    map.set(key, group);
  }
  return [...map.values()].sort((a, b) => {
    if (groupBy === "priority") return priorityRank(a.key as Priority) - priorityRank(b.key as Priority);
    return b.items.length - a.items.length;
  });
}

function BulkTaskModal({
  open,
  count,
  onClose,
  onSubmit,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (options: { grouped: boolean; assignee: string; priority: string; title: string }) => void;
}) {
  const [grouped, setGrouped] = useState(count > 1);
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [title, setTitle] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aufgaben aus Alarmen"
      subtitle={`${count} ${count === 1 ? "Alarm" : "Alarme"} ausgewählt`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            icon={ClipboardPlus}
            onClick={() => {
              onSubmit({ grouped, assignee, priority, title });
              onClose();
            }}
          >
            Erstellen
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Toggle
          checked={grouped}
          onChange={setGrouped}
          label="Zu einer Aufgabe zusammenfassen"
          description="Empfohlen bei zusammenhängenden Alarmen. Sonst wird pro Alarm eine Aufgabe erstellt."
        />
        <label className="field">
          <span>Assignee</span>
          <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="z. B. N. Weber" />
        </label>
        <label className="field">
          <span>Priorität</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Aus Alarmen übernehmen</option>
            <option value="P1">P1 · Kritisch</option>
            <option value="P2">P2 · Hoch</option>
            <option value="P3">P3 · Normal</option>
            <option value="P4">P4 · Beobachten</option>
          </select>
        </label>
        <label className="field">
          <span>Titel (optional)</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Automatisch aus Alarmen" />
        </label>
      </div>
    </Modal>
  );
}

export function Alerts() {
  const {
    alertViews,
    devices,
    conditions,
    organizationMap,
    locationMap,
    settings,
    updateSettings,
    ackAlert,
    setAlertPriority,
    resetAlert,
    bulkCreateTasks,
    priorityCounts,
    suppressedCount,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">((searchParams.get("priority") as Priority) ?? "");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showSuppressed, setShowSuppressed] = useState(settings.showSuppressed || searchParams.get("suppressed") === "1");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sort, setSort] = useState<SortKey>("priority");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const { views, save, remove } = useSavedViews("alerts");

  const conditionParam = searchParams.get("condition");
  const deviceParam = searchParams.get("device");
  const incidentParam = searchParams.get("incident");
  const alertParam = searchParams.get("alert");
  const selectedView = alertParam ? alertViews.find((view) => view.alert.uid === alertParam) : undefined;

  useEffect(() => {
    if (searchParams.get("suppressed") === "1") setShowSuppressed(true);
    if (searchParams.get("priority")) setPriorityFilter(searchParams.get("priority") as Priority);
    if (searchParams.get("q")) setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get("suppressed")) setShowSuppressed(settings.showSuppressed);
  }, [settings.showSuppressed]);

  useEffect(() => {
    setPage(1);
  }, [query, priorityFilter, filters, showSuppressed, sort, groupBy]);

  const conditionFilter = useMemo(() => {
    if (!conditionParam) return undefined;
    return conditions.find((condition) => condition.id === conditionParam);
  }, [conditionParam, conditions]);

  const sources = useMemo(
    () => [...new Set(alertViews.map((view) => view.alert.sourceName))].sort((a, b) => a.localeCompare(b, "de")),
    [alertViews],
  );
  const organizations = useMemo(() => [...organizationMap.values()].sort((a, b) => a.name.localeCompare(b.name, "de")), [organizationMap]);
  const locations = useMemo(
    () =>
      [...locationMap.values()]
        .filter((location) => !filters.organization || String(location.organizationId) === filters.organization)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [locationMap, filters.organization],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const ageCutoff = filters.age ? now - Number(filters.age) * 60_000 : undefined;
    return alertViews.filter((view) => {
      const { alert, device, suppression, incident } = view;
      if (!showSuppressed && suppression && filters.status !== "suppressed") return false;
      if (priorityFilter && view.priority !== priorityFilter) return false;
      if (
        query &&
        !matchesQuery(
          query,
          alert.message,
          alert.subject,
          alert.sourceName,
          alert.sourceType,
          alert.uid,
          device?.displayName,
          device?.organizationName,
          device?.locationName,
          device?.tags.join(" "),
        )
      ) {
        return false;
      }
      if (filters.severity && alert.severity !== filters.severity) return false;
      if (filters.organization && String(device?.organizationId ?? "") !== filters.organization) return false;
      if (filters.location && String(device?.locationId ?? "") !== filters.location) return false;
      if (filters.nodeGroup && device?.nodeGroup !== filters.nodeGroup) return false;
      if (filters.category && alert.category !== filters.category) return false;
      if (filters.source && alert.sourceName !== filters.source) return false;
      if (filters.status === "open" && alert.acknowledged) return false;
      if (filters.status === "acknowledged" && !alert.acknowledged) return false;
      if (filters.status === "suppressed" && !suppression) return false;
      if (filters.status === "root" && incident?.rootCauseAlertUid !== alert.uid) return false;
      if (ageCutoff && alert.createdAt < ageCutoff) return false;
      if (deviceParam && String(alert.deviceId) !== deviceParam) return false;
      if (incidentParam && incident?.id !== incidentParam) return false;
      if (conditionParam) {
        if (conditionFilter) {
          if (
            alert.sourceType !== conditionFilter.sourceType &&
            alert.sourceName !== conditionFilter.name &&
            alert.sourceConfigUid !== conditionFilter.id
          ) {
            return false;
          }
        } else if (alert.sourceType !== conditionParam) {
          return false;
        }
      }
      return true;
    });
  }, [alertViews, showSuppressed, filters, priorityFilter, query, deviceParam, incidentParam, conditionParam, conditionFilter]);

  const sorted = useMemo(() => sortAlerts(filtered, sort), [filtered, sort]);
  const displayed = useMemo(
    () => (groupBy === "none" ? paginate(sorted, page - 1, PAGE_SIZE) : sorted),
    [sorted, page, groupBy],
  );
  const groups = useMemo(
    () => (groupBy === "none" ? [] : groupAlerts(sorted, groupBy)),
    [sorted, groupBy],
  );
  const totalPages = pageCount(sorted.length, PAGE_SIZE);

  const related = useMemo(
    () =>
      selectedView
        ? alertViews
            .filter(
              (view) =>
                view.alert.uid !== selectedView.alert.uid &&
                (view.alert.deviceId === selectedView.alert.deviceId ||
                  (selectedView.incident && view.incident?.id === selectedView.incident.id)),
            )
            .sort(sortScoredAlerts)
        : [],
    [alertViews, selectedView],
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "organization" ? { location: "" } : {}) }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
    setPriorityFilter("");
    setShowSuppressed(false);
    const next = new URLSearchParams(searchParams);
    for (const key of ["condition", "device", "incident", "suppressed", "priority", "q"]) next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const toggleSelected = (uid: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAll = () => {
    setSelected((current) => (current.size === displayed.length ? new Set() : new Set(displayed.map((view) => view.alert.uid))));
  };

  const activeFilters = [
    query ? { key: "query", label: `Suche: ${query}` } : null,
    priorityFilter ? { key: "priority", label: PRIORITY_LABEL[priorityFilter] } : null,
    conditionFilter ? { key: "condition", label: `Bedingung: ${conditionFilter.name}` } : conditionParam ? { key: "condition", label: conditionParam } : null,
    deviceParam ? { key: "device", label: `Gerät: ${devices.find((device) => String(device.id) === deviceParam)?.displayName ?? deviceParam}` } : null,
    incidentParam ? { key: "incident", label: `Incident: ${incidentParam}` } : null,
    filters.severity ? { key: "severity", label: SEVERITY_LABEL[filters.severity as keyof typeof SEVERITY_LABEL] } : null,
    filters.organization ? { key: "organization", label: organizations.find((org) => String(org.id) === filters.organization)?.name ?? filters.organization } : null,
    filters.location ? { key: "location", label: locations.find((loc) => String(loc.id) === filters.location)?.name ?? filters.location } : null,
    filters.nodeGroup ? { key: "nodeGroup", label: NODE_GROUP_LABEL[filters.nodeGroup as keyof typeof NODE_GROUP_LABEL] } : null,
    filters.category ? { key: "category", label: CATEGORY_LABEL[filters.category as keyof typeof CATEGORY_LABEL] } : null,
    filters.source ? { key: "source", label: filters.source } : null,
    filters.status ? { key: "status", label: filters.status === "open" ? "Offen" : filters.status === "acknowledged" ? "Bestätigt" : filters.status === "suppressed" ? "Symptome" : "Ursachen" } : null,
    filters.age ? { key: "age", label: `Älter als ${filters.age} min` } : null,
  ].filter((entry): entry is { key: string; label: string } => Boolean(entry));

  const removeFilter = (key: string) => {
    if (key === "query") setQuery("");
    else if (key === "priority") setPriorityFilter("");
    else if (key === "condition" || key === "device" || key === "incident") setParam(key, null);
    else setFilter(key as keyof Filters, "");
  };

  const applyView = (saved: (typeof views)[number]) => {
    setQuery(saved.query);
    const next: Filters = {
      severity: saved.filters.severity?.[0] ?? "",
      organization: saved.filters.organization?.[0] ?? "",
      location: saved.filters.location?.[0] ?? "",
      nodeGroup: saved.filters.nodeGroup?.[0] ?? "",
      category: saved.filters.category?.[0] ?? "",
      source: saved.filters.source?.[0] ?? "",
      status: saved.filters.status?.[0] ?? "",
      age: saved.filters.age?.[0] ?? "",
    };
    setFilters(next);
    setPriorityFilter((saved.filters.priority?.[0] as Priority) ?? "");
    setShowSuppressed(saved.filters.showSuppressed?.[0] === "1");
    setSort((saved.sort as SortKey) || "priority");
    setGroupBy((saved.groupBy as GroupBy) || "none");
  };

  const saveView = (name: string) => {
    save({
      name,
      query,
      filters: {
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, [value]])),
        ...(priorityFilter ? { priority: [priorityFilter] } : {}),
        ...(showSuppressed ? { showSuppressed: ["1"] } : {}),
      },
      sort,
      groupBy,
    });
  };

  const toggleSuppressed = (next: boolean) => {
    setShowSuppressed(next);
    void updateSettings({ showSuppressed: next });
  };

  const bulkAck = async () => {
    for (const uid of selected) await ackAlert(uid, true);
    setSelected(new Set());
  };

  return (
    <div className="page alerts-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <Siren size={13} aria-hidden />
            {alertViews.length} aktive Alarme · {suppressedCount} als Symptom erklärt
          </span>
        }
        title="Alarme"
        description="Priorisiert, filterbar und mit vollständiger Kausalitäts-Erklärung. Symptome sind standardmäßig ausgeblendet – nie ohne Begründung."
        actions={
          <>
            <Button variant="ghost" icon={showSuppressed ? EyeOff : Eye} onClick={() => toggleSuppressed(!showSuppressed)}>
              {showSuppressed ? "Symptome ausblenden" : "Symptome anzeigen"}
            </Button>
            <Button variant="primary" icon={Filter} onClick={() => setFiltersOpen((open) => !open)}>
              Filter
            </Button>
          </>
        }
      />

      <div className="priority-strip">
        <button type="button" className={cn("priority-strip__item", !priorityFilter && "is-active")} onClick={() => setPriorityFilter("")}>
          <span className="priority-strip__value">{alertViews.length}</span>
          <span className="priority-strip__label">Alle</span>
        </button>
        {(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => (
          <button
            type="button"
            key={priority}
            className={cn("priority-strip__item", `priority-strip__item--${priority.toLowerCase()}`, priorityFilter === priority && "is-active")}
            onClick={() => setPriorityFilter(priorityFilter === priority ? "" : priority)}
          >
            <span className="priority-strip__value">{priorityCounts[priority]}</span>
            <span className="priority-strip__label">{PRIORITY_LABEL[priority]}</span>
          </button>
        ))}
        <div className="priority-strip__spacer" />
        <div className="priority-strip__suppressed">
          <Progress value={alertViews.length ? (suppressedCount / alertViews.length) * 100 : 0} tone="violet" />
          <span>
            <strong>{suppressedCount}</strong> Symptome
          </span>
        </div>
      </div>

      {suppressedCount > 0 ? (
        <div className="suppression-banner">
          <span className="suppression-banner__icon">
            <GitBranch size={19} aria-hidden />
          </span>
          <div className="suppression-banner__text">
            <strong>
              {suppressedCount} Alarme sind durch {new Set(alertViews.filter((view) => view.suppression).map((view) => view.incident?.id)).size} Ursachen erklärt.
            </strong>
            <span>
              {showSuppressed
                ? "Symptome werden aktuell angezeigt. Sie sind als Symptom markiert und zählen nicht als eigenständige Vorfälle."
                : "Sie sind ausgeblendet, damit du zuerst die Ursache siehst. Jede Unterdrückung ist nachvollziehbar."}
            </span>
          </div>
          <Button size="sm" variant="soft" icon={showSuppressed ? EyeOff : Eye} onClick={() => toggleSuppressed(!showSuppressed)}>
            {showSuppressed ? "Ausblenden" : "Symptome anzeigen"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/causality")}>
            Kausalität
          </Button>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchInput
            className="toolbar__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Alarm, Gerät, Organisation, Source oder UID suchen …"
            aria-label="Alarme durchsuchen"
          />
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sortierung">
            <option value="priority">Priorität</option>
            <option value="newest">Neueste</option>
            <option value="oldest">Älteste</option>
            <option value="severity">Severity</option>
            <option value="device">Gerät</option>
            <option value="source">Quelle</option>
          </Select>
          <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)} aria-label="Gruppierung">
            <option value="none">Nicht gruppieren</option>
            <option value="priority">Nach Priorität</option>
            <option value="incident">Nach Ursache</option>
            <option value="device">Nach Gerät</option>
            <option value="organization">Nach Organisation</option>
            <option value="location">Nach Standort</option>
            <option value="category">Nach Kategorie</option>
            <option value="source">Nach Quelle</option>
          </Select>
          <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setFiltersOpen((open) => !open)}>
            Filter {activeFilters.length > 0 ? `(${activeFilters.length})` : ""}
          </Button>
          <SavedViews views={views} onApply={applyView} onSave={saveView} onRemove={remove} />
        </div>

        {filtersOpen ? (
          <div className="toolbar__filters">
            <Select value={filters.severity} onChange={(event) => setFilter("severity", event.target.value)} aria-label="Severity">
              <option value="">Alle Severities</option>
              {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
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
            <Select value={filters.source} onChange={(event) => setFilter("source", event.target.value)} aria-label="Quelle">
              <option value="">Alle Quellen</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
            <Select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} aria-label="Status">
              <option value="">Alle Status</option>
              <option value="open">Offen</option>
              <option value="acknowledged">Bestätigt</option>
              <option value="suppressed">Symptome</option>
              <option value="root">Ursachen</option>
            </Select>
            <Select value={filters.age} onChange={(event) => setFilter("age", event.target.value)} aria-label="Alter">
              <option value="">Beliebiges Alter</option>
              <option value="15">Älter als 15 min</option>
              <option value="60">Älter als 1 h</option>
              <option value="1440">Älter als 24 h</option>
              <option value="10080">Älter als 7 Tage</option>
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
          <button type="button" className="text-link" onClick={selectAll}>
            {selected.size === displayed.length && displayed.length > 0 ? "Auswahl aufheben" : "Alle auf dieser Seite auswählen"}
          </button>
          <span className="dot-sep">·</span>
          <span>
            <strong>{sorted.length}</strong> Treffer
          </span>
          {groupBy !== "none" ? (
            <>
              <span className="dot-sep">·</span>
              <span>{groups.length} Gruppen</span>
            </>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="bulk-bar__count">{selected.size} ausgewählt</span>
          <Button size="sm" variant="primary" icon={ClipboardPlus} onClick={() => setBulkOpen(true)}>
            Aufgaben erstellen
          </Button>
          <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => void bulkAck()}>
            Bestätigen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Auswahl aufheben
          </Button>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Inbox}
            title="Keine Alarme für diese Filter"
            description="Passe Suche oder Filter an. Symptome sind standardmäßig ausgeblendet – eventuell ist der gesuchte Alarm als Symptom klassifiziert."
            action={
              <div className="empty-actions">
                <Button variant="secondary" icon={RotateCcw} onClick={resetFilters}>
                  Filter zurücksetzen
                </Button>
                <Button variant="ghost" icon={Eye} onClick={() => toggleSuppressed(true)}>
                  Symptome anzeigen
                </Button>
              </div>
            }
          />
        </Panel>
      ) : groupBy === "none" ? (
        <Panel>
          <div className="alert-list">
            {displayed.map((view) => (
              <AlertRow
                key={view.alert.uid}
                view={view}
                showCheckbox
                selected={selected.has(view.alert.uid)}
                onToggle={toggleSelected}
                onOpen={(entry) => setParam("alert", entry.alert.uid)}
                onAck={(entry) => void ackAlert(entry.alert.uid, !entry.alert.acknowledged)}
                onTask={(entry) => void bulkCreateTasks({ alertIds: [entry.alert.uid] })}
              />
            ))}
          </div>
          <div className="pagination">
            <span>
              Seite {page} von {totalPages} · {sorted.length} Alarme
            </span>
            <div className="pagination__controls">
              <Button size="sm" variant="ghost" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Zurück
              </Button>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Weiter <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="alert-groups">
          {groups.map((group) => (
            <Panel className="alert-group" key={group.key}>
              <div className="alert-group__header">
                <Layers size={15} aria-hidden />
                <h2>{group.label}</h2>
                <Badge tone="neutral">{group.items.length}</Badge>
                <div className="alert-group__priority">
                  {(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => {
                    const count = group.items.filter((view) => view.priority === priority).length;
                    return count > 0 ? (
                      <span key={priority} className={`priority-dot priority-dot--${priority.toLowerCase()}`} title={`${PRIORITY_LABEL[priority]}: ${count}`}>
                        {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="alert-list">
                {group.items.map((view) => (
                  <AlertRow
                    key={view.alert.uid}
                    view={view}
                    showCheckbox
                    selected={selected.has(view.alert.uid)}
                    onToggle={toggleSelected}
                    onOpen={(entry) => setParam("alert", entry.alert.uid)}
                    onAck={(entry) => void ackAlert(entry.alert.uid, !entry.alert.acknowledged)}
                    onTask={(entry) => void bulkCreateTasks({ alertIds: [entry.alert.uid] })}
                  />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <BulkTaskModal
        key={selected.size}
        open={bulkOpen}
        count={selected.size}
        onClose={() => setBulkOpen(false)}
        onSubmit={(options) => {
          void bulkCreateTasks({
            alertIds: [...selected],
            grouped: options.grouped,
            assignee: options.assignee,
            priority: (options.priority as Priority) || undefined,
            title: options.title || undefined,
          });
          setSelected(new Set());
        }}
      />

      {selectedView ? (
        <AlertDrawer
          view={selectedView}
          related={related}
          onClose={() => setParam("alert", null)}
          onAck={() => void ackAlert(selectedView.alert.uid, !selectedView.alert.acknowledged)}
          onTask={() => void bulkCreateTasks({ alertIds: [selectedView.alert.uid] })}
          onReset={() => void resetAlert(selectedView.alert.uid)}
          onPriority={(priority) => void setAlertPriority(selectedView.alert.uid, priority)}
          onOpenAlert={(entry) => setParam("alert", entry.alert.uid)}
          onOpenDevice={() => selectedView.device && navigate(`/devices?device=${selectedView.device.id}`)}
          onOpenIncident={() => selectedView.incident && navigate(`/causality?incident=${encodeURIComponent(selectedView.incident.id)}`)}
        />
      ) : null}
    </div>
  );
}
