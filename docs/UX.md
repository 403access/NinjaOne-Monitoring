# UX & Design

## 1. Haltung

Signal ist ein **ruhiges Operations-Cockpit**. Es sieht aus wie ein Werkzeug für Menschen, die nachts um 3 Uhr eine Entscheidung treffen müssen: hoher Kontrast, klare Prioritäten, keine dekorative Ablenkung.

Drei Leitideen:

1. **Ein Blick reicht.** Priorität, Ursache und Handlung sind in jeder Zeile erkennbar.
2. **Erklärung statt Magie.** Jede Ausblendung, jeder Score und jede Empfehlung ist nachvollziehbar.
3. **Dichte mit Luft.** Kompakte Tabellen, aber großzügige Abstände zwischen Gruppen und klare Typo-Hierarchie.

## 2. Informationsarchitektur

```text
Übersicht
├─ KPIs, Root Causes, Standort-Health, Volumen, Aktivität
Bedingungen
├─ Hierarchie: Organisation → Standort → Geräteklasse → Kategorie → Condition
├─ Filter/Suche/Sortierung, gespeicherte Ansichten
Alarme
├─ Priorisierte Liste, Suppression-Banner, Bulk-Aktionen
├─ Detail-Drawer: Evidenz, Timeline, Rohdaten, Gerät
Kausalität
├─ Incidents, Graph, Suppression-Explorer, externe Signale, Regeln
Aufgaben
├─ Board/Liste, CRUD, verknüpfte Alarme, SLA
Geräte
├─ Inventar, Status, Parent-Kette, Alarme/Conditions/Tasks
Einstellungen
├─ Darstellung, Datenquelle, Priorität, Kausalität, Daten
```

## 3. Navigation

- **Desktop ≥ 1180 px:** feste Sidebar (248 px), Topbar mit globaler Suche, Sync-Status, Theme.
- **Tablet 768–1179 px:** Sidebar als Icon-Leiste (72 px) mit Tooltips.
- **Mobile < 768 px:** Topbar mit Menü, Bottom-Navigation für die fünf häufigsten Ziele (Übersicht, Alarme, Kausalität, Aufgaben, Mehr), Details als Vollbild-Drawer.
- **Command Palette:** ⌘K / Strg+K, Pfeiltasten, Enter, Escape. Durchsucht Alarme, Conditions, Geräte, Aufgaben und Aktionen.

## 4. Visuelle Sprache

### Farben (Dark)

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--bg` | `#080c12` | App-Hintergrund |
| `--surface` | `#0f151e` | Karten |
| `--surface-2` | `#151e29` | Erhöhte Flächen |
| `--border` | `rgba(148,163,184,.14)` | Trennlinien |
| `--text` | `#e7eef7` | Primärtext |
| `--muted` | `#8fa0b5` | Sekundärtext |
| `--accent` | `#2dd4bf` | Aktionen, Fokus |
| `--accent-2` | `#38bdf8` | Links, Charts |

### Prioritäten

| Priorität | Farbe | Bedeutung |
| --- | --- | --- |
| P1 | `#fb7185` (Rose) | Sofort, Ausfall, Sicherheit |
| P2 | `#fbbf24` (Amber) | Hoch, bald |
| P3 | `#38bdf8` (Sky) | Normal |
| P4 | `#94a3b8` (Slate) | Beobachten |

### Typografie

- Sans: `ui-sans-serif, -apple-system, "Segoe UI", Inter, sans-serif`
- Mono: `ui-monospace, SFMono-Regular, "JetBrains Mono", monospace` für UIDs, Rohdaten, Zeitstempel.
- Skala: 11 / 12 / 13 / 14 / 16 / 20 / 28 / 36 px. Tabellen 13 px, Fließtext 14 px.

### Form

- Radien: 8 px (klein), 12 px (Karten), 16 px (Panels), 999 px (Chips).
- Schatten nur für schwebende Ebenen (Drawer, Palette), nicht für jede Karte.
- 1-px-Borders und subtile Verläufe statt harter Schatten.

## 5. Kernkomponenten

| Komponente | Regeln |
| --- | --- |
| `PriorityBadge` | Farbe + Text, nie nur Farbe (a11y) |
| `StatusDot` | 8 px, Puls nur bei aktiven kritischen Zuständen |
| `DataToolbar` | Suche, Filter, Sortierung, Gruppierung, Ansicht, gespeicherte Ansicht |
| `FilterChips` | Aktive Filter sichtbar, einzeln entfernbar, „Alle zurücksetzen“ |
| `Drawer` | Rechts, 480–560 px, mobil Vollbild, Escape schließt, Fokusfalle |
| `Modal` | Nur für Bestätigungen und kurze Formulare |
| `Toast` | Unten rechts, 4 s, mit Undo bei destruktiven Aktionen |
| `EmptyState` | Erklärt, warum leer, und bietet die nächste Aktion |
| `Skeleton` | Shimmer nur beim Erstladen, nie bei Filterwechsel |
| `KpiCard` | Zahl, Label, Trend, Kontext; klickbar zum gefilterten Ziel |

## 6. Responsive Regeln

| Breakpoint | Verhalten |
| --- | --- |
| < 640 px | Einspaltig, Karten statt Tabellen, Filter als Bottom-Sheet, Aktionen in Overflow-Menü |
| 640–1023 px | Zweispaltige Karten, Tabellen mit horizontalem Scroll und Sticky erster Spalte |
| 1024–1179 px | Icon-Sidebar, Tabellen kompakt |
| ≥ 1180 px | Volle Sidebar, dichte Tabellen, Detail-Drawer parallel |

Tabellen werden auf Mobile zu **Alert Cards**: Priorität + Titel + Gerät + Alter + eine Primäraktion. Alle Filter bleiben erreichbar.

## 7. Interaktion & Mikrocopy

- Primäraktion pro Seite: „Synchronisieren“, „Aufgabe erstellen“, „Signal melden“.
- Suppression-Banner: „12 Alarme werden durch 3 Ursachen erklärt. [Anzeigen] [Warum?]“
- Leerer Filter: „Keine Treffer für ‚Spooler‘. [Filter zurücksetzen]“
- Destruktiv: „Alarm zurücksetzen? Der Alarm wird in NinjaOne geschlossen. [Abbrechen] [Zurücksetzen]“
- Ladezustand: „NinjaOne-Daten werden geladen … Letzter Stand vor 2 min.“
- Fehler: „Live-Sync fehlgeschlagen. Du siehst den letzten Stand von 14:32. [Erneut versuchen]“

## 8. Accessibility

- Kontrast ≥ 4,5:1 für Text, ≥ 3:1 für große Elemente.
- Sichtbarer Fokusring (`outline: 2px solid var(--accent)`, Offset 2 px).
- Alle Icons mit `aria-label` oder begleitendem Text.
- Tabellen mit `<th scope="col">`, Sortier-`aria-sort`.
- Drawer/Modal: Fokusfalle, Escape, Rückgabe des Fokus.
- Reduced Motion: `prefers-reduced-motion` deaktiviert Puls/Shimmer/Transitions.
- Farbe nie alleiniger Bedeutungsträger.

## 9. Tastatur

| Kürzel | Aktion |
| --- | --- |
| ⌘K / Strg+K | Command Palette |
| `g` dann `d` | Übersicht |
| `g` dann `a` | Alarme |
| `g` dann `c` | Bedingungen |
| `g` dann `k` | Kausalität |
| `g` dann `t` | Aufgaben |
| `Esc` | Drawer/Palette schließen |
| `?` | Shortcut-Hilfe (geplant) |

## 10. Motion

- 120–180 ms für Hover/Fokus, 220 ms für Drawer.
- Kein Bounce, kein Springen von Zahlen ohne Grund.
- Prioritätswechsel wird kurz hervorgehoben, nicht dauerhaft animiert.
