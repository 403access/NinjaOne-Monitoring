# Technologie & Architektur

## 1. Stack

| Baustein | Entscheidung | Begründung |
| --- | --- | --- |
| Runtime | **Bun 1.4** | Ein Prozess für Server, Bundling und Tests; native SQLite; schnelle Iteration |
| Sprache | **TypeScript** (strict) | Domänensicherheit über Server und Client |
| UI | **React 19** + React Router 7 | Komponentenmodell, URL-basierte Navigation |
| Styling | **Plain CSS** mit Design-Tokens | Kein Build-Overhead, volle Kontrolle über Dark/Light und Responsive |
| Icons | **lucide-react** | Konsistente, leichte SVG-Icons |
| Persistenz | **bun:sqlite** | Null-Config, transaktional, lokal, ideal für Tasks/Signale/Regeln |
| API | **NinjaOne Public API 2.0** | Offizielle, dokumentierte Schnittstelle |
| Tests | **bun:test** | Schnell, im Runtime enthalten |
| Build | **Bun HTML Imports + `bun build`** | Full-Stack-Dev mit HMR, statischer Browser-Build |

Keine UI-Framework-Abhängigkeit (kein Tailwind, keine Chart-Library). Charts und Graphen sind bewusst leichtgewichtiges SVG/CSS.

## 2. Prozessarchitektur

```text
┌──────────────────────────── Browser (React) ────────────────────────────┐
│  Pages: Dashboard · Conditions · Alerts · Causality · Tasks · Devices   │
│  Shared: types · priority engine · causality engine · filters           │
│  State: BootstrapContext + URL/localStorage views                       │
└───────────────────────────────▲──────────────────────────────────────────┘
                                │ /api/* (JSON, same origin)
┌───────────────────────────────┴──────────────────────────────────────────┐
│                           Bun.serve (src/index.ts)                       │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ API router   │  │ Snapshot      │  │ SQLite store │  │ Demo data   │  │
│  │ tasks/signals│  │ orchestrator  │  │ settings     │  │ generator   │  │
│  │ rules/sync   │  │ normalize     │  │ tasks        │  │ (seeded)    │  │
│  └──────┬───────┘  └───────┬───────┘  │ signals      │  └─────────────┘  │
│         │                  │          │ rules/cache  │                   │
│         │          ┌───────▼───────┐  └──────────────┘                   │
│         │          │ NinjaOne      │                                     │
│         │          │ client        │  OAuth2 · Retry · Pagination        │
│         │          └───────┬───────┘                                     │
└─────────┼──────────────────┼─────────────────────────────────────────────┘
          │                  │ HTTPS
          ▼                  ▼
   local persistence   NinjaOne Public API 2.0
```

**Ein Origin.** Der Browser spricht nur mit dem Bun-Server. Dieser hält OAuth-Tokens und Secrets, normalisiert NinjaOne-Daten und liefert einen konsistenten Snapshot. Kein CORS, keine Tokens im Client.

## 3. Verzeichnisstruktur

```text
src/
  index.ts                 Bun.serve, HTML-Route, API-Route
  index.html               React-Einstieg
  shared/                  Typen, Prioritäts- und Kausalitätsengine (isomorph)
  server/
    api.ts                 REST-Router
    store.ts               SQLite-Schema und Repositories
    snapshot.ts            Orchestrierung Demo/Live, Cache
    ninja/client.ts        OAuth2, Fetch, Retry, Pagination
    ninja/normalize.ts     Offizielle Felder → Domäne
    demo/data.ts           Deterministischer Demo-Tenant
  frontend/
    App.tsx, main.tsx      Router und Provider
    components/            Shell, UI-Bausteine, Charts, Command Palette
    pages/                 Sieben Kernseiten
    lib/                   Filter, Formatierung, Hooks
    styles.css             Tokens, Layout, Komponenten
tests/                     Engine-Tests
docs/                      Produkt, API, Architektur, UX, Roadmap
```

## 4. Datenfluss

1. **Bootstrap:** Client ruft `GET /api/bootstrap` auf.
2. **Snapshot:** Server wählt Demo oder Live.
   - Demo: deterministischer Generator relativ zu „jetzt“.
   - Live: paralleler Abruf von Alerts, Devices, Policies, Organizations, Locations, Device Health und Aktivitäten; Normalisierung; Cache in SQLite.
3. **Anreicherung:** Prioritätsengine und Kausalitätsengine laufen **im Client** auf dem Snapshot. Vorteil: Regeländerungen sind sofort sichtbar, ohne Roundtrip. Die Engines sind pure Functions und werden auch serverseitig für Tests genutzt.
4. **Mutationen:** Tasks, externe Signale, Regeländerungen und Alert-Overrides gehen an den Server und werden in SQLite persistiert; die Antwort enthält den aktualisierten Datensatz.
5. **Resilienz:** Schlägt Live-Sync fehl, liefert der Server den letzten Cache mit `stale: true`, `lastSync` und Fehlermeldung. Die UI bleibt bedienbar.

## 5. Server-API

| Route | Methoden | Zweck |
| --- | --- | --- |
| `/api/health` | GET | Liveness, Modus, Version |
| `/api/bootstrap` | GET | Kompletter Snapshot + Settings + Regeln + Signale + Tasks |
| `/api/sync` | POST | Live-Sync oder Demo-Reset |
| `/api/settings` | PATCH | Theme, Modus, Refresh, Prioritätsmatrix, Causality-Toggles |
| `/api/tasks` | GET, POST | Aufgaben lesen/erstellen |
| `/api/tasks/:id` | PATCH, DELETE | Aufgabe ändern/löschen |
| `/api/signals` | GET, POST | Externe Signale lesen/erstellen |
| `/api/signals/:id` | PATCH, DELETE | Signal ändern/beenden |
| `/api/priority-rules` | GET, PUT | Prioritätsregeln |
| `/api/alerts/:uid/ack` | POST | Lokales Acknowledgement |
| `/api/alerts/:uid/reset` | POST | Live: NinjaOne-Reset; Demo: lokal |
| `/api/alerts/bulk-task` | POST | Bulk-Aufgabenerstellung |
| `/api/webhook/ninjaone` | POST | Webhook-Empfänger (vorbereitet) |
| `/api/export` | GET | JSON-Export des Arbeitsstands |

## 6. SQLite-Schema (Auszug)

```sql
settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)
tasks(id TEXT PRIMARY KEY, title TEXT, description TEXT, status TEXT, priority TEXT,
      assignee TEXT, due_at INTEGER, created_at INTEGER, updated_at INTEGER,
      alert_ids TEXT, device_ids TEXT, tags TEXT, checklist TEXT, source TEXT)
signals(id TEXT PRIMARY KEY, type TEXT, title TEXT, scope TEXT, starts_at INTEGER,
        ends_at INTEGER, status TEXT, notes TEXT, effects TEXT, created_at INTEGER)
priority_rules(id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER)
alert_state(uid TEXT PRIMARY KEY, acknowledged INTEGER, priority_override TEXT, updated_at INTEGER)
audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, actor TEXT, action TEXT, payload TEXT)
snapshot_cache(key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER)
```

## 7. Sicherheit

- Secrets ausschließlich in `.env`/Prozessumgebung; `.env` ist ignoriert.
- Keine Tokens, Client-IDs oder Roh-Responses im Frontend.
- Same-Origin-API, strikte JSON-Antworten, Größenlimits für Bodies.
- Aktionen mit Außenwirkung (NinjaOne-Reset) erfordern Bestätigung und sind im Audit-Log vorgesehen.
- Demo-Modus ist Default; Live-Modus muss explizit aktiviert werden.
- Webhook-Empfänger: vorgesehen für Secret-Header-Prüfung, Idempotenz und Queue (M4).

## 8. Performance

- Snapshot einmal laden, danach clientseitig filtern/sortieren (bei den erwarteten Größenordnungen bis einige tausend Alerts unkritisch).
- Listen paginieren (25–50 Zeilen) und Aggregationen memoisieren.
- Keine schweren Chart-Libraries; SVG mit wenigen Pfaden.
- SQLite-Indizes auf Status, Fälligkeit und Updated-Zeit.
- Bun-Server liefert gebündelte Assets; Produktion mit `bun run build` und statischem `dist/`.

## 9. Testing

- **Unit:** Prioritätsmatrix, Regel-Matching, Suppression (Agent/Parent/Switch/WAN/Maintenance/Flapping), Root-Cause-Schutz, Incident-Aggregation.
- **Typen:** `bun run typecheck`.
- **Smoke:** `curl /api/health`, `/api/bootstrap`, Task-CRUD.
- **Geplant:** Playwright für Kernflows und Responsive-Snapshots.

## 10. Deployment

```bash
bun install --frozen-lockfile
bun run build
NODE_ENV=production PORT=3000 bun src/index.ts
```

Empfohlen: Container, Reverse Proxy mit TLS, `.env` aus Secrets-Manager, persistentes Volume für `.data/signal.sqlite`, Healthcheck auf `/api/health`. Für Multi-Instanzen SQLite durch Postgres ersetzen (Repository-Interface ist gekapselt).
