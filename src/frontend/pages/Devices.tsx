import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  ClipboardPlus,
  Cpu,
  HardDrive,
  LayoutGrid,
  List,
  MapPin,
  Network,
  RadioTower,
  Server,
  ShieldCheck,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NODE_GROUP_LABEL } from "../../shared/constants";
import type { Device } from "../../shared/types";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/cn";
import { matchesQuery } from "../lib/filters";
import { formatRelative } from "../lib/format";
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
  TaskStatusBadge,
} from "../components/ui/Primitives";
import { SavedViews } from "../components/ui/SavedViews";

type DeviceStatus = "online" | "offline" | "maintenance";
type SortKey = "name" | "status" | "class" | "lastContact" | "alerts";

const NODE_ICON: Record<string, LucideIcon> = {
  server: Server,
  endpoint: Cpu,
  network: Network,
  virtualization: HardDrive,
  cloud: ShieldCheck,
};

function statusOf(device: Device): DeviceStatus {
  if (device.maintenance) return "maintenance";
  return device.offline ? "offline" : "online";
}

function DeviceStatusBadge({ device }: { device: Device }) {
  const status = statusOf(device);
  return (
    <Badge tone={status === "online" ? "success" : status === "offline" ? "danger" : "warning"} dot>
      {status === "online" ? "Online" : status === "offline" ? "Offline" : "Wartung"}
    </Badge>
  );
}

function DeviceDrawer({
  device,
  onClose,
  onShowAlerts,
  onShowTasks,
  onOpenAlert,
  onOpenTask,
  onCreateTask,
  onSignal,
}: {
  device: Device;
  onClose: () => void;
  onShowAlerts: () => void;
  onShowTasks: () => void;
  onOpenAlert: (uid: string) => void;
  onOpenTask: (id: string) => void;
  onCreateTask: () => void;
  onSignal: () => void;
}) {
  const { deviceMap, alertViews, tasks, conditions } = useApp();
  const alerts = alertViews.filter((view) => view.alert.deviceId === device.id).sort((a, b) => a.priority.localeCompare(b.priority));
  const linkedTasks = tasks.filter((task) => task.deviceIds.includes(device.id));
  const children = [...deviceMap.values()].filter((entry) => entry.parentDeviceId === device.id);
  const chain: Device[] = [];
  let current: Device | undefined = device;
  const visited = new Set<number>();
  while (current?.parentDeviceId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = deviceMap.get(current.parentDeviceId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  const applicableConditions = conditions
    .filter(
      (condition) =>
        (condition.scopeLevel === "global" ||
          condition.organizationId === device.organizationId ||
          condition.locationId === device.locationId) &&
        (condition.nodeClasses.length === 0 || condition.nodeClasses.includes(device.nodeClass)),
    )
    .sort((a, b) => a.priority.localeCompare(b.priority));
  const Icon = NODE_ICON[device.nodeGroup] ?? Server;

  return (
    <Drawer
      open
      onClose={onClose}
      width="wide"
      title={device.displayName}
      subtitle={`${device.organizationName} · ${device.locationName}`}
      headerExtra={<DeviceStatusBadge device={device} />}
      footer={
        <>
          <Button variant="ghost" icon={RadioTower} onClick={onSignal}>
            Signal
          </Button>
          <Button variant="secondary" icon={ClipboardPlus} onClick={onCreateTask}>
            Aufgabe
          </Button>
          <Button variant="primary" icon={ArrowUpRight} onClick={onShowAlerts}>
            Alarme anzeigen
          </Button>
        </>
      }
    >
      <div className="device-hero">
        <span className={cn("device-hero__icon", device.offline && "is-offline")}>
          <Icon size={26} aria-hidden />
        </span>
        <div>
          <strong>{device.os}</strong>
          <span>{device.role}</span>
        </div>
        <div className="device-hero__meta">
          <span>
            <MapPin size={12} /> {device.locationName}
          </span>
          <span>
            <Network size={12} /> {device.ip ?? "keine IP"}
          </span>
          <span>
            <ShieldCheck size={12} /> {device.policyName ?? "keine Policy"}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <span>Status</span>
          <strong className={device.offline ? "text-danger" : "text-success"}>{device.offline ? "Offline" : "Online"}</strong>
          <small>Letzter Kontakt {formatRelative(device.lastContact)}</small>
        </div>
        <div>
          <span>Geräteklasse</span>
          <strong>{device.nodeClass}</strong>
          <small>{NODE_GROUP_LABEL[device.nodeGroup]}</small>
        </div>
        <div>
          <span>System</span>
          <strong>{device.systemName || device.displayName}</strong>
          <small>{device.os}</small>
        </div>
        <div>
          <span>Netzwerk</span>
          <strong className="mono">{device.ip ?? "—"}</strong>
          <small>{device.publicIp ? `Public ${device.publicIp}` : "Keine Public IP"}</small>
        </div>
        <div>
          <span>Policy</span>
          <strong>{device.policyName ?? "—"}</strong>
          <small>Policy-ID {device.policyId ?? "—"}</small>
        </div>
        <div>
          <span>Wartung</span>
          <strong>{device.maintenance ? "Aktiv" : "Nein"}</strong>
          <small>{device.maintenanceUntil ? `bis ${formatRelative(device.maintenanceUntil)}` : "Kein Wartungsfenster"}</small>
        </div>
      </div>

      <section className="detail-section">
        <h3>Tags</h3>
        <div className="detail-tags">
          {device.tags.length > 0 ? device.tags.map((tag) => <span className="device-chip" key={tag}>{tag}</span>) : <span className="muted">Keine Tags</span>}
        </div>
      </section>

      <section className="detail-section">
        <h3>Topologie</h3>
        <div className="topology">
          {chain.map((parent) => (
            <span className="topology__node" key={parent.id}>
              <Server size={13} /> {parent.displayName}
              <ChevronRight size={12} />
            </span>
          ))}
          <span className="topology__node is-current">
            <Server size={13} /> {device.displayName}
          </span>
          {children.length > 0 ? (
            <div className="topology__children">
              {children.map((child) => (
                <span className="topology__node" key={child.id}>
                  {child.displayName}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Aktive Alarme</h3>
          <Badge tone={alerts.length > 0 ? "danger" : "success"}>{alerts.length}</Badge>
        </div>
        {alerts.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="Keine aktiven Alarme" description="Dieses Gerät ist aktuell unauffällig." />
        ) : (
          <div className="alert-list detail-alert-list">
            {alerts.slice(0, 6).map((view) => (
              <AlertRow key={view.alert.uid} view={view} compact onOpen={() => onOpenAlert(view.alert.uid)} />
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Aufgaben</h3>
          <Badge tone="neutral">{linkedTasks.length}</Badge>
        </div>
        {linkedTasks.length === 0 ? (
          <EmptyState compact icon={ClipboardPlus} title="Keine Aufgaben" description="Für dieses Gerät ist nichts offen." />
        ) : (
          <div className="device-task-list">
            {linkedTasks.map((task) => (
              <button type="button" key={task.id} className="device-task-row" onClick={() => onOpenTask(task.id)}>
                <PriorityBadge priority={task.priority} compact />
                <span>{task.title}</span>
                <TaskStatusBadge status={task.status} />
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Anwendbare Bedingungen</h3>
          <Badge tone="neutral">{applicableConditions.length}</Badge>
        </div>
        <div className="condition-chip-list">
          {applicableConditions.slice(0, 10).map((condition) => (
            <span className="condition-chip" key={condition.id}>
              <span className={cn("condition-chip__dot", `condition-chip__dot--${condition.severity.toLowerCase()}`)} />
              {condition.name}
            </span>
          ))}
          {applicableConditions.length > 10 ? <span className="muted">+{applicableConditions.length - 10} weitere</span> : null}
        </div>
      </section>

      <div className="device-drawer-actions">
        <Button variant="ghost" icon={ClipboardPlus} onClick={onShowTasks}>
          Alle Aufgaben
        </Button>
      </div>
    </Drawer>
  );
}

export function Devices() {
  const { devices, alertViews, tasks, organizationMap, locationMap, createTask } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [nodeGroup, setNodeGroup] = useState("");
  const [status, setStatus] = useState<DeviceStatus | "">("");
  const [sort, setSort] = useState<SortKey>("status");
  const [view, setView] = useState<"table" | "cards">("table");
  const { views, save, remove } = useSavedViews("devices");

  const deviceParam = searchParams.get("device");
  const selected = deviceParam ? devices.find((device) => device.id === Number(deviceParam)) : undefined;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const organizations = useMemo(() => [...organizationMap.values()].sort((a, b) => a.name.localeCompare(b.name, "de")), [organizationMap]);
  const locations = useMemo(
    () => [...locationMap.values()].filter((entry) => !organization || String(entry.organizationId) === organization).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [locationMap, organization],
  );

  const filtered = useMemo(() => {
    const list = devices.filter((device) => {
      if (
        query &&
        !matchesQuery(query, device.displayName, device.systemName, device.ip, device.os, device.role, device.organizationName, device.locationName, device.tags.join(" "))
      ) {
        return false;
      }
      if (organization && String(device.organizationId) !== organization) return false;
      if (location && String(device.locationId) !== location) return false;
      if (nodeGroup && device.nodeGroup !== nodeGroup) return false;
      if (status && statusOf(device) !== status) return false;
      return true;
    });
    const alertCounts = new Map<number, number>();
    for (const view of alertViews) alertCounts.set(view.alert.deviceId, (alertCounts.get(view.alert.deviceId) ?? 0) + 1);
    return list.sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName, "de");
      if (sort === "class") return a.nodeClass.localeCompare(b.nodeClass, "de");
      if (sort === "lastContact") return a.lastContact - b.lastContact;
      if (sort === "alerts") return (alertCounts.get(b.id) ?? 0) - (alertCounts.get(a.id) ?? 0);
      return Number(b.offline) - Number(a.offline) || a.displayName.localeCompare(b.displayName, "de");
    });
  }, [devices, query, organization, location, nodeGroup, status, sort, alertViews]);

  const alertCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const view of alertViews) map.set(view.alert.deviceId, (map.get(view.alert.deviceId) ?? 0) + 1);
    return map;
  }, [alertViews]);

  const taskCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const task of tasks) for (const id of task.deviceIds) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [tasks]);

  const online = devices.filter((device) => statusOf(device) === "online").length;
  const offline = devices.filter((device) => statusOf(device) === "offline").length;
  const maintenance = devices.filter((device) => statusOf(device) === "maintenance").length;

  const applyView = (saved: (typeof views)[number]) => {
    setQuery(saved.query);
    setOrganization(saved.filters.organization?.[0] ?? "");
    setLocation(saved.filters.location?.[0] ?? "");
    setNodeGroup(saved.filters.nodeGroup?.[0] ?? "");
    setStatus((saved.filters.status?.[0] as DeviceStatus) ?? "");
    setSort((saved.sort as SortKey) || "status");
    setView((saved.groupBy as "table" | "cards") || "table");
  };

  const saveView = (name: string) => {
    save({
      name,
      query,
      filters: {
        ...(organization ? { organization: [organization] } : {}),
        ...(location ? { location: [location] } : {}),
        ...(nodeGroup ? { nodeGroup: [nodeGroup] } : {}),
        ...(status ? { status: [status] } : {}),
      },
      sort,
      groupBy: view,
    });
  };

  const resetFilters = () => {
    setQuery("");
    setOrganization("");
    setLocation("");
    setNodeGroup("");
    setStatus("");
    setParam("location", null);
  };

  const hasFilters = Boolean(query || organization || location || nodeGroup || status);

  return (
    <div className="page devices-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <Server size={13} aria-hidden />
            {devices.length} Geräte · {online} online · {offline} offline
          </span>
        }
        title="Geräte"
        description="Inventar mit Parent-Topologie, Alarmen, Aufgaben und den Bedingungen, die für dieses Gerät gelten."
        actions={
          <Button variant="ghost" icon={Network} onClick={() => navigate("/causality")}>
            Kausalität
          </Button>
        }
      />

      <div className="device-stats">
        <button type="button" className={cn("device-stat", !status && "is-active")} onClick={() => setStatus("")}>
          <span>Gesamt</span>
          <strong>{devices.length}</strong>
        </button>
        <button type="button" className={cn("device-stat device-stat--online", status === "online" && "is-active")} onClick={() => setStatus(status === "online" ? "" : "online")}>
          <span>Online</span>
          <strong>{online}</strong>
        </button>
        <button type="button" className={cn("device-stat device-stat--offline", status === "offline" && "is-active")} onClick={() => setStatus(status === "offline" ? "" : "offline")}>
          <span>Offline</span>
          <strong>{offline}</strong>
        </button>
        <button type="button" className={cn("device-stat device-stat--maintenance", status === "maintenance" && "is-active")} onClick={() => setStatus(status === "maintenance" ? "" : "maintenance")}>
          <span>Wartung</span>
          <strong>{maintenance}</strong>
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchInput
            className="toolbar__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gerät, IP, OS, Rolle, Tag oder Standort suchen …"
          />
          <Select value={organization} onChange={(event) => { setOrganization(event.target.value); setLocation(""); }} aria-label="Organisation">
            <option value="">Alle Organisationen</option>
            {organizations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
          <Select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Standort">
            <option value="">Alle Standorte</option>
            {locations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
          <Select value={nodeGroup} onChange={(event) => setNodeGroup(event.target.value)} aria-label="Geräteklasse">
            <option value="">Alle Klassen</option>
            {Object.entries(NODE_GROUP_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value as DeviceStatus | "")} aria-label="Status">
            <option value="">Alle Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Wartung</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sortierung">
            <option value="status">Status</option>
            <option value="name">Name</option>
            <option value="class">Klasse</option>
            <option value="lastContact">Letzter Kontakt</option>
            <option value="alerts">Alarme</option>
          </Select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Tabelle", icon: List },
              { value: "cards", label: "Karten", icon: LayoutGrid },
            ]}
            ariaLabel="Ansicht"
          />
          <SavedViews views={views} onApply={applyView} onSave={saveView} onRemove={remove} />
        </div>
        {hasFilters ? (
          <div className="active-filters">
            {query ? <span className="active-filter">Suche: {query}</span> : null}
            {organization ? <span className="active-filter">Org: {organizations.find((entry) => String(entry.id) === organization)?.name}</span> : null}
            {location ? <span className="active-filter">Standort: {locations.find((entry) => String(entry.id) === location)?.name}</span> : null}
            {nodeGroup ? <span className="active-filter">Klasse: {NODE_GROUP_LABEL[nodeGroup as keyof typeof NODE_GROUP_LABEL]}</span> : null}
            {status ? <span className="active-filter">Status: {status}</span> : null}
            <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
              <Wrench size={13} /> Zurücksetzen
            </button>
          </div>
        ) : null}
        <div className="toolbar__meta">
          <span>
            <strong>{filtered.length}</strong> von {devices.length} Geräten
          </span>
          <span className="dot-sep">·</span>
          <span>{view === "table" ? "Tabellenansicht" : "Kartenansicht"}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState icon={Server} title="Keine Geräte gefunden" description="Passe Suche oder Filter an." action={<Button onClick={resetFilters}>Filter zurücksetzen</Button>} />
        </Panel>
      ) : view === "table" ? (
        <Panel>
          <div className="table-wrap">
            <table className="data-table device-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Gerät</th>
                  <th>Klasse</th>
                  <th>Organisation / Standort</th>
                  <th>IP</th>
                  <th>Letzter Kontakt</th>
                  <th>Parent</th>
                  <th>Alarme</th>
                  <th>Aufgaben</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => {
                  const parent = device.parentDeviceId ? devices.find((entry) => entry.id === device.parentDeviceId) : undefined;
                  const Icon = NODE_ICON[device.nodeGroup] ?? Server;
                  return (
                    <tr key={device.id} onClick={() => setParam("device", String(device.id))}>
                      <td>
                        <DeviceStatusBadge device={device} />
                      </td>
                      <td>
                        <div className="device-cell">
                          <span className={cn("device-cell__icon", device.offline && "is-offline")}>
                            <Icon size={14} />
                          </span>
                          <div className="cell-main">
                            <strong>{device.displayName}</strong>
                            <span>{device.os}</span>
                          </div>
                        </div>
                      </td>
                      <td>{NODE_GROUP_LABEL[device.nodeGroup]}</td>
                      <td>
                        <div className="cell-main">
                          <strong>{device.organizationName}</strong>
                          <span>{device.locationName}</span>
                        </div>
                      </td>
                      <td className="cell-mono">{device.ip ?? "—"}</td>
                      <td>{formatRelative(device.lastContact)}</td>
                      <td>{parent?.displayName ?? "—"}</td>
                      <td>
                        {alertCounts.get(device.id) ? <Badge tone="danger">{alertCounts.get(device.id)}</Badge> : <span className="muted">0</span>}
                      </td>
                      <td>{taskCounts.get(device.id) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <div className="device-grid">
          {filtered.map((device) => {
            const Icon = NODE_ICON[device.nodeGroup] ?? Server;
            return (
              <button type="button" key={device.id} className={cn("device-card", device.offline && "is-offline")} onClick={() => setParam("device", String(device.id))}>
                <div className="device-card__top">
                  <span className="device-card__icon">
                    <Icon size={18} />
                  </span>
                  <DeviceStatusBadge device={device} />
                  <ChevronRight size={15} className="device-card__chevron" />
                </div>
                <strong>{device.displayName}</strong>
                <span className="device-card__os">{device.os}</span>
                <div className="device-card__meta">
                  <span>
                    <Building2 size={11} /> {device.organizationName}
                  </span>
                  <span>
                    <MapPin size={11} /> {device.locationName}
                  </span>
                  <span>
                    <Network size={11} /> {device.ip ?? "—"}
                  </span>
                  <span>
                    <Tag size={11} /> {device.tags.slice(0, 2).join(", ") || "—"}
                  </span>
                </div>
                <div className="device-card__footer">
                  <span>{formatRelative(device.lastContact)}</span>
                  <span>
                    {alertCounts.get(device.id) ?? 0} Alarme · {taskCounts.get(device.id) ?? 0} Aufgaben
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <DeviceDrawer
          device={selected}
          onClose={() => setParam("device", null)}
          onShowAlerts={() => navigate(`/alerts?device=${selected.id}`)}
          onShowTasks={() => navigate("/tasks")}
          onOpenAlert={(uid) => uid && navigate(`/alerts?alert=${encodeURIComponent(uid)}`)}
          onOpenTask={(id) => navigate(`/tasks?task=${encodeURIComponent(id)}`)}
          onCreateTask={() =>
            void createTask({
              title: `Gerät prüfen: ${selected.displayName}`,
              description: `${selected.displayName} (${selected.nodeClass}) in ${selected.organizationName} / ${selected.locationName} prüfen.`,
              priority: selected.offline ? "P1" : "P3",
              deviceIds: [selected.id],
              tags: selected.tags.slice(0, 3),
            })
          }
          onSignal={() => navigate("/causality?signal=1")}
        />
      ) : null}
    </div>
  );
}
