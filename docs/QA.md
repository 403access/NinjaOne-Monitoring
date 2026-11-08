# QA & Verifikation

Stand: 2026-11-09

## 1. Automatisierte Checks

| Check | Befehl | Ergebnis |
| --- | --- | --- |
| TypeScript strict | `bun run typecheck` | ✅ 0 Fehler |
| Unit-Tests | `bun test` | ✅ 22 Tests, 81 Assertions |
| Produktions-Build | `bun run build` | ✅ Bundle in `dist/` |
| Server-Smoke | `curl /api/health` | ✅ `ok: true`, Modus + Credentials |
| Bootstrap | `curl /api/bootstrap` | ✅ 43 Geräte, 55 Alarme, 42 Conditions, 7 Tasks, 2 Signale |
| Task-CRUD | `POST/PATCH/DELETE /api/tasks` | ✅ |
| Bulk-Task | `POST /api/alerts/bulk-task` | ✅ einzeln und gruppiert |
| Signal-CRUD | `POST/PATCH/DELETE /api/signals` | ✅ inkl. Resolve |
| Priority-Rules | `PUT /api/priority-rules` | ✅ persistiert |
| Causality-Rules | `PUT /api/causality-rules` | ✅ persistiert |
| Alert-Override | `POST /api/alerts/:uid/priority` | ✅ |
| Demo-Reset | `POST /api/demo/reset` | ✅ |
| Export | `GET /api/export` | ✅ JSON-Download |

### Unit-Test-Abdeckung

- **Priorität:** Security P1, Disk < 5 % P1, SMART P1, manueller Override, Wartung vs. Security, Flapping, deaktivierte Regel, Sortierung, konfigurierbare Severity-Matrix.
- **Kausalität:** 5 Root Causes, WAN-Suppression + Root-Schutz, Switch-Suppression, Parent/Host-Suppression, Agent-offline-Suppression, Security nie unterdrückt, Standalone-Hardware sichtbar, deaktivierte Regel, hohe Schwelle, Power-Signal, konsistente Statistiken.
- **Normalisierung:** offizielle Felder → Domäne, Sekunden → Millisekunden, Maintenance, Tags, abgeleitete Conditions, Health, fehlende optionale Daten.

## 2. Browser-Flows (Playwright + Chrome)

| Flow | Ergebnis |
| --- | --- |
| Dashboard lädt, KPIs, Root Causes, Standort-Health | ✅ keine Console-Errors |
| Conditions: Suche „PACS“ | ✅ 42 → 1 Treffer |
| Conditions: Gruppierung nach Kategorie | ✅ 10 Gruppen |
| Conditions: Detail-Drawer | ✅ Scope, Policy, Schwelle, Trigger, Alarme, API-Hinweis |
| Alerts: Filter, Prioritäts-Chips, Bulk-Auswahl | ✅ |
| Alerts: Detail-Drawer | ✅ Prioritätsgründe, Incident, Gerät, Rohdaten |
| Alerts: Bulk-Aufgabe | ✅ Toast + Aufgabe |
| Alerts: Prioritäts-Override | ✅ |
| Kausalität: Incidents + Graph | ✅ |
| Kausalität: Symptome-Tab | ✅ 28 Suppressions |
| Kausalität: Regeln-Tab | ✅ 8 Regeln, Threshold, Historie |
| Signal-Modal: POWER-Signal anlegen | ✅ Incident neu berechnet |
| Tasks: Board, Karten, Drag-&-Drop-Status | ✅ |
| Tasks: Detail-Drawer, Checkliste, Speichern | ✅ |
| Tasks: neue Aufgabe | ✅ |
| Devices: Tabelle, Filter, Detail-Drawer, Topologie | ✅ |
| Settings: Theme, Prioritätsmatrix, Regeln | ✅ |
| Settings: Live-Modus ohne Credentials | ✅ Stale-Banner + Fallback |
| Command Palette (⌘K) | ✅ |
| Mobile 390 × 844: Dashboard, Alerts, Causality, Drawer | ✅ |

## 3. Responsive Breakpoints

| Breite | Ergebnis |
| --- | --- |
| 1440 px | Volle Sidebar, dichte Tabellen, Detail-Drawer parallel |
| 1180 px | Icon-Sidebar, kompakte Tabellen |
| 900 px | Bottom-Navigation, einspaltige Karten |
| 390 px | Karten statt Tabellen, Filter gestapelt, Drawer Vollbild, Bulk-Bar über Bottom-Nav |

## 4. Accessibility-Spotchecks

- Sichtbarer Fokusring auf Buttons, Inputs, Drawer-Close.
- Priorität nie nur über Farbe: Text + Badge.
- `aria-label` für Icon-Buttons, `aria-modal`, `role="dialog"`, `aria-expanded` für Gruppen.
- Escape schließt Drawer/Modal/Palette.
- `prefers-reduced-motion` deaktiviert Animationen.
- Tabellen mit `<th>`, Sortier-`aria-sort`.

## 5. Bewusste Testlücken

- **Kein Live-Tenant:** Es lagen keine NinjaOne-Credentials vor. Der Live-Pfad ist implementiert, typisiert und mit einem normalisierten Sample getestet; der Fallback ohne Credentials wurde im Browser verifiziert.
- **Kein echter 429-Test:** Retry/Backoff ist implementiert, aber ohne Tenant nicht gegen echte Limits getestet.
- **Keine Cross-Browser-Matrix:** Chrome/Playwright; Safari/Firefox stehen aus.
- **Keine Lasttests:** Erwartete Größenordnung einige tausend Alerts; Listen sind paginiert, aber nicht virtualisiert.

## 6. Reproduktion

```bash
bun install
bun run check
bun run build
PORT=3100 bun src/index.ts
```

Demo zurücksetzen:

```bash
curl -X POST http://localhost:3100/api/demo/reset
```
