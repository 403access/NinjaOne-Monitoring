import {
  ChevronRight,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/cn";
import { formatRelative } from "../lib/format";
import { MOBILE_NAV_PATHS, NAV_ITEMS, navItemForPath } from "../lib/navigation";
import { CommandPalette } from "./CommandPalette";
import { Button, IconButton, Kbd } from "./ui/Primitives";

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden>
      <svg viewBox="0 0 40 40" width="28" height="28">
        <path d="M6 26c4-1.5 5-10 9-10s5 8 9 8 4-5 6-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="31" cy="18" r="3.2" fill="var(--danger)" />
      </svg>
    </span>
  );
}

function NavBadge({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const { priorityCounts, incidents, openTasks } = useApp();
  if (item.badge === "alerts" && priorityCounts.P1 > 0) {
    return <span className="nav-badge nav-badge--danger">{priorityCounts.P1}</span>;
  }
  if (item.badge === "incidents" && incidents.length > 0) {
    return <span className="nav-badge">{incidents.length}</span>;
  }
  if (item.badge === "tasks" && openTasks.length > 0) {
    return <span className="nav-badge">{openTasks.length}</span>;
  }
  return null;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { payload, settings } = useApp();
  const groups = ["Betrieb", "Konfiguration", "System"] as const;
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <LogoMark />
        <div>
          <div className="sidebar__name">Signal</div>
          <div className="sidebar__tagline">NinjaOne Console</div>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Hauptnavigation">
        {groups.map((group) => (
          <div className="sidebar__group" key={group}>
            <div className="sidebar__group-label">{group}</div>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) => cn("sidebar__link", isActive && "is-active")}
                >
                  <Icon size={17} aria-hidden />
                  <span>{item.label}</span>
                  <NavBadge item={item} />
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="mode-card">
          <div className="mode-card__top">
            <span className={cn("status-dot", payload?.snapshot.meta.stale ? "status-dot--warning" : "status-dot--success")} />
            <span>{payload?.snapshot.meta.mode === "live" ? "Live-Tenant" : "Demo-Modus"}</span>
          </div>
          <div className="mode-card__label">{payload?.snapshot.meta.tenant ?? "demo.ninjarmm.local"}</div>
          <div className="mode-card__meta">
            {payload ? `Sync ${formatRelative(payload.snapshot.meta.lastSync)}` : "Verbinde …"}
          </div>
        </div>
        <div className="sidebar__version">
          <span>v0.1.0</span>
          <span>{settings.theme === "light" ? "Light" : settings.theme === "system" ? "Auto" : "Dark"}</span>
        </div>
      </div>
    </aside>
  );
}

export function AppShell() {
  const { payload, settings, updateSettings, sync, syncing } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItemForPath(location.pathname);
  const keyBuffer = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (typing) return;
      if (event.key === "g") {
        keyBuffer.current = { key: "g", at: Date.now() };
        return;
      }
      if (keyBuffer.current && Date.now() - keyBuffer.current.at < 900) {
        const map: Record<string, string> = {
          d: "/",
          a: "/alerts",
          c: "/causality",
          k: "/causality",
          t: "/tasks",
          b: "/conditions",
          g: "/devices",
          s: "/settings",
        };
        const destination = map[event.key.toLowerCase()];
        if (destination) {
          event.preventDefault();
          navigate(destination);
        }
        keyBuffer.current = null;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const nextTheme = settings.theme === "light" ? "dark" : "light";
  const mobileItems = useMemo(() => NAV_ITEMS.filter((item) => MOBILE_NAV_PATHS.includes(item.path)), []);
  const moreActive = !MOBILE_NAV_PATHS.includes(current.path) && current.path !== "/settings";

  return (
    <div className="app">
      <Sidebar />
      <div className="app__main">
        <header className="topbar">
          <div className="topbar__left">
            <IconButton icon={Menu} label="Navigation öffnen" className="topbar__menu" onClick={() => setMobileOpen(true)} />
            <div className="breadcrumb">
              <span className="breadcrumb__root">Signal</span>
              <ChevronRight size={13} aria-hidden />
              <span>{current.label}</span>
            </div>
          </div>
          <div className="topbar__right">
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
              <Search size={15} aria-hidden />
              <span>Suche & Befehle</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button type="button" className={cn("sync-pill", syncing && "is-busy")} onClick={() => void sync()} title="NinjaOne synchronisieren">
              <RefreshCw size={14} className={syncing ? "spin" : undefined} aria-hidden />
              <span className="sync-pill__label">{payload?.snapshot.meta.stale ? "Stale" : "Synchron"}</span>
              <span className="sync-pill__time">{payload ? formatRelative(payload.snapshot.meta.lastSync) : "—"}</span>
            </button>
            <IconButton
              icon={settings.theme === "light" ? Moon : Sun}
              label={settings.theme === "light" ? "Dark Theme aktivieren" : "Light Theme aktivieren"}
              onClick={() => void updateSettings({ theme: nextTheme })}
            />
            <div className="topbar__avatar" title="Operations">
              OP
            </div>
          </div>
        </header>

        {payload?.snapshot.meta.stale ? (
          <div className="stale-banner" role="status">
            <WifiOff size={16} aria-hidden />
            <div>
              <strong>Letzter bekannter Stand.</strong>{" "}
              {payload.snapshot.meta.staleReason ?? "Live-Sync nicht verfügbar."}
            </div>
            <Button size="sm" variant="ghost" icon={RefreshCw} loading={syncing} onClick={() => void sync()}>
              Erneut versuchen
            </Button>
          </div>
        ) : null}

        <main className="content">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Mobile Navigation">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <NavLink key={item.path} to={item.path} className={cn("bottom-nav__item", active && "is-active")}>
                <Icon size={20} aria-hidden />
                <span>{item.shortLabel}</span>
                {item.badge === "alerts" ? <NavBadge item={item} /> : null}
              </NavLink>
            );
          })}
          <button type="button" className={cn("bottom-nav__item", moreActive && "is-active")} onClick={() => setMobileOpen(true)}>
            <Menu size={20} aria-hidden />
            <span>Mehr</span>
          </button>
        </nav>
      </div>

      {mobileOpen ? (
        <div className="mobile-nav-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMobileOpen(false)}>
          <div className="mobile-nav">
            <div className="mobile-nav__header">
              <div className="sidebar__brand">
                <LogoMark />
                <div>
                  <div className="sidebar__name">Signal</div>
                  <div className="sidebar__tagline">NinjaOne Console</div>
                </div>
              </div>
              <IconButton icon={X} label="Navigation schließen" onClick={() => setMobileOpen(false)} />
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
