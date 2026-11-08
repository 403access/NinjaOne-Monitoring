# Roadmap

Status: **MVP gebaut** (siehe `docs/CHANGELOG.md`). Die Roadmap beschreibt den gelieferten Stand und die nächsten Ausbaustufen.

## M0 — Research & Entscheidungen ✅

- [x] Offizielle NinjaOne-Public-API-2.0-Dokumentation auswerten
- [x] Auth-Flow (OAuth 2.0 Client Credentials) und Regionshosts dokumentieren
- [x] Alert-, Activity-, Device-, Policy-, Health- und Webhook-Schemas erfassen
- [x] Condition-Typen und NMS-Online/Offline-Logik recherchieren
- [x] API-Lücken dokumentieren (keine Conditions in `/v2/policies`, keine Severity/Priority am aktiven Alert)
- [x] Architektur-, Produkt- und UX-Entscheidungen festhalten

## M1 — Fundament ✅

- [x] Bun + TypeScript + React, ein Full-Stack-Prozess
- [x] Git-Repository, Commit pro Schritt
- [x] Domänenmodell und Design-Tokens
- [x] SQLite-Persistenz für Aufgaben, Signale, Einstellungen, Regeln
- [x] Demo-Datenlayer mit realistischer Topologie
- [x] NinjaOne-Client mit Token-Cache, Retry, Pagination, Timeout
- [x] Normalisierung und Fallback auf letzten Snapshot

## M2 — Operative Oberfläche ✅

- [x] App-Shell, Sidebar, Topbar, mobile Navigation
- [x] Dashboard mit KPIs, Root Causes, Standort-Health, Volumen
- [x] Conditions-Explorer mit Hierarchie und allen Filtern
- [x] Alarm-Workspace mit Priorität, Suche, Facetten, Bulk-Aktionen
- [x] Geräte-Inventar inkl. Parent-Topologie
- [x] Aufgaben: Board, Liste, CRUD, Verknüpfung
- [x] Dark/Light Theme, responsive Breakpoints
- [x] Command Palette, Toasts, gespeicherte Ansichten

## M3 — Kausalität ✅

- [x] Prioritätsengine mit editierbarer Matrix und Regeln
- [x] Suppression-Regeln: Agent offline, Parent offline, Netzwerkpfad, WAN, Wartung, Flapping, externe Signale
- [x] Incident-Bildung, Konfidenz, Evidenz, Impact
- [x] Kausalitätszentrum inkl. Graph und Suppression-Explorer
- [x] Externe Signale (ISP, Strom, Switch, Wartung)
- [x] Aufgaben-Empfehlungen aus Incidents
- [x] Unit-Tests für Priorität und Kausalität

## M4 — Produktionsreife (nächste Schritte)

- [ ] Persistente Snapshot-Historie und Trendanalyse (SQLite/Parquet)
- [ ] Webhook-Ingestion produktiv: Signaturprüfung, Queue, Idempotenz
- [ ] Hintergrund-Sync mit Backoff und Tenant-Rate-Limit-Monitor
- [ ] Authentifizierung (OIDC) und Rollen (Viewer, Dispatcher, Admin)
- [ ] Audit-Log für Aktionen (Reset, Task, Signal)
- [ ] Multi-Tenant-/MSP-Ansicht mit Kundenwechsel
- [ ] Topologie-Editor für Switch-/Port-Abhängigkeiten
- [ ] PSA-/Ticketing-Integration (`/v2/ticketing/*`) optional
- [ ] Export (CSV/PDF) und SLA-Reporting
- [ ] E2E-Tests (Playwright) und visuelle Regression
- [ ] Observability: strukturierte Logs, Metriken, Health-Endpoint
- [ ] Deployment: Container, Reverse Proxy, Secrets-Manager

## M5 — Intelligence (Vision)

- [ ] Historische Kausalitätsmuster lernen („dieser Switch flappt dienstags“)
- [ ] Prognose: Disk-/Backup-Risiko vor dem Alarm
- [ ] Ähnliche Incidents und Lösungshistorie
- [ ] Natürlichsprachige Lage-Zusammenfassung (optional, mit klarer Datenhoheit)
- [ ] Automatisierte Runbook-Vorschläge, weiterhin freigabepflichtig

## Meilenstein-Kriterien

| Meilenstein | Definition of Done |
| --- | --- |
| M1 | `bun run dev` startet, `/api/bootstrap` liefert Demo-Snapshot, Daten überleben Neustart |
| M2 | Alle Kernseiten auf Desktop und 390 px nutzbar, Filter/Sortierung/Suche vorhanden |
| M3 | Suppression erklärbar, umschaltbar, getestet; Root Cause nie unterdrückt |
| M4 | Live-Tenant sicher angebunden, Auth, Audit, Betrieb dokumentiert |
