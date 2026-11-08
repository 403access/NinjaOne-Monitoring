import {
  ArrowRight,
  ClipboardPlus,
  CornerDownLeft,
  GitBranch,
  MonitorSmartphone,
  Moon,
  RefreshCw,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { normalize } from "../lib/filters";
import { NAV_ITEMS } from "../lib/navigation";
import { Kbd } from "./ui/Primitives";

interface CommandItem {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { alertViews, conditions, devices, tasks, sync, updateSettings, settings } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const items = useMemo<CommandItem[]>(() => {
    const navigation: CommandItem[] = NAV_ITEMS.map((item) => ({
      id: `nav:${item.path}`,
      group: "Navigation",
      title: item.label,
      subtitle: item.description,
      icon: item.icon,
      action: () => navigate(item.path),
      keywords: item.description,
    }));

    const actions: CommandItem[] = [
      {
        id: "action:sync",
        group: "Aktionen",
        title: "Jetzt synchronisieren",
        subtitle: "NinjaOne-Daten neu laden",
        icon: RefreshCw,
        action: () => void sync(),
      },
      {
        id: "action:new-task",
        group: "Aktionen",
        title: "Neue Aufgabe erstellen",
        subtitle: "Manuelle Aufgabe anlegen",
        icon: ClipboardPlus,
        action: () => navigate("/tasks?new=1"),
      },
      {
        id: "action:signal",
        group: "Aktionen",
        title: "Externes Signal melden",
        subtitle: "ISP, Strom, Switch oder Wartung",
        icon: GitBranch,
        action: () => navigate("/causality?signal=1"),
      },
      {
        id: "action:theme",
        group: "Aktionen",
        title: settings.theme === "light" ? "Dark Theme aktivieren" : "Light Theme aktivieren",
        subtitle: "Darstellung wechseln",
        icon: settings.theme === "light" ? Moon : Sun,
        action: () => void updateSettings({ theme: settings.theme === "light" ? "dark" : "light" }),
      },
    ];

    const alerts: CommandItem[] = [...alertViews]
      .sort((a, b) => a.priority.localeCompare(b.priority))
      .slice(0, 40)
      .map((view) => ({
        id: `alert:${view.alert.uid}`,
        group: "Alarme",
        title: view.alert.message,
        subtitle: `${view.priority} · ${view.device?.displayName ?? "Gerät"} · ${view.device?.locationName ?? ""}`,
        icon: Search,
        action: () => navigate(`/alerts?alert=${encodeURIComponent(view.alert.uid)}`),
        keywords: `${view.alert.sourceName} ${view.alert.sourceType} ${view.device?.organizationName ?? ""}`,
      }));

    const conditionItems: CommandItem[] = conditions.slice(0, 60).map((condition) => ({
      id: `condition:${condition.id}`,
      group: "Bedingungen",
      title: condition.name,
      subtitle: `${condition.category} · ${condition.policyName}`,
      icon: GitBranch,
      action: () => navigate(`/conditions?condition=${encodeURIComponent(condition.id)}`),
      keywords: `${condition.sourceType} ${condition.organizationName ?? ""} ${condition.locationName ?? ""}`,
    }));

    const deviceItems: CommandItem[] = devices.slice(0, 60).map((device) => ({
      id: `device:${device.id}`,
      group: "Geräte",
      title: device.displayName,
      subtitle: `${device.organizationName} · ${device.locationName} · ${device.offline ? "offline" : "online"}`,
      icon: MonitorSmartphone,
      action: () => navigate(`/devices?device=${device.id}`),
      keywords: `${device.nodeClass} ${device.ip ?? ""} ${device.tags.join(" ")}`,
    }));

    const taskItems: CommandItem[] = tasks.slice(0, 40).map((task) => ({
      id: `task:${task.id}`,
      group: "Aufgaben",
      title: task.title,
      subtitle: `${task.priority} · ${task.assignee} · ${task.status}`,
      icon: ClipboardPlus,
      action: () => navigate(`/tasks?task=${encodeURIComponent(task.id)}`),
      keywords: `${task.tags.join(" ")} ${task.description}`,
    }));

    return [...navigation, ...actions, ...alerts, ...conditionItems, ...deviceItems, ...taskItems];
  }, [alertViews, conditions, devices, tasks, navigate, sync, updateSettings, settings.theme]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) {
      const preferred = items.filter((item) => item.group === "Navigation" || item.group === "Aktionen");
      const topAlerts = items.filter((item) => item.group === "Alarme").slice(0, 5);
      return [...preferred, ...topAlerts];
    }
    return items.filter((item) => normalize(`${item.title} ${item.subtitle ?? ""} ${item.keywords ?? ""}`).includes(needle)).slice(0, 30);
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    item.action();
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="command" role="dialog" aria-modal="true" aria-label="Befehlspalette">
        <div className="command__search">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Alarme, Bedingungen, Geräte, Aufgaben oder Aktionen …"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelected((current) => Math.min(filtered.length - 1, current + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelected((current) => Math.max(0, current - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                run(filtered[selected]);
              }
            }}
            aria-label="Suche"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="command__results">
          {grouped.length === 0 ? (
            <div className="command__empty">Keine Treffer für „{query}“.</div>
          ) : (
            grouped.map(([group, groupItems]) => (
              <div className="command__group" key={group}>
                <div className="command__group-label">{group}</div>
                {groupItems.map((item) => {
                  const index = filtered.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`command__item ${index === selected ? "is-selected" : ""}`}
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => run(item)}
                    >
                      <span className="command__item-icon">
                        <Icon size={16} aria-hidden />
                      </span>
                      <span className="command__item-text">
                        <span>{item.title}</span>
                        {item.subtitle ? <small>{item.subtitle}</small> : null}
                      </span>
                      {index === selected ? <CornerDownLeft size={14} aria-hidden /> : <ArrowRight size={14} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <footer className="command__footer">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigieren
          </span>
          <span>
            <Kbd>↵</Kbd> öffnen
          </span>
          <span className="command__hint">Signal Command</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
