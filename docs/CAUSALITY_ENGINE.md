# Kausalitätsengine

## 1. Problem

Monitoring erzeugt Symptome. Ein Switch verliert Strom, dahinter liegen 20 Geräte. NinjaOne meldet:

- 1 × NMS Device Down (Switch)
- 8 × Agent Offline
- 6 × Ping Response
- 4 × HTTP Check
- 3 × Port Check

Der eigentliche Vorfall ist der Switch – oder die WAN-Leitung, die den Switch vom Monitoring trennt. Ohne Kausalität sieht ein Dispatcher 22 Alarme. Mit Kausalität sieht er **einen Incident mit 21 Symptomen** und einer klaren Handlung.

## 2. Grundmodell

Jeder Alarm hat:

```ts
type Alert = {
  uid: string;
  deviceId: number;
  sourceType: string;      // z. B. AGENT_OFFLINE, CONDITION_PING
  category: ConditionCategory;
  severity: Severity;
  createdAt: number;
  device: Device;          // inkl. parentDeviceId, offline, maintenance, tags
};
```

Die Engine erzeugt:

```ts
type CausalityResult = {
  incidents: Incident[];          // Root Causes + Impact
  suppressions: Suppression[];    // warum ein Alarm ausgeblendet ist
  links: CausalLink[];            // Ursache → Wirkung
  stats: { total, suppressed, rootCauses, byRule };
};
```

### Suppression

```ts
type Suppression = {
  alertUid: string;
  ruleId: string;
  rootCauseAlertUid?: string;
  rootCauseDeviceId?: number;
  confidence: number;             // 0..1
  explanation: string;
  evidence: string[];
};
```

**Guardrails:**

1. Root Causes werden nie unterdrückt.
2. Jede Unterdrückung ist sichtbar und abschaltbar.
3. Konfidenz < 0,7 unterdrückt standardmäßig nicht, sondern markiert nur.
4. Ein Alarm kann nur eine primäre Suppression haben; weitere werden als Evidenz angehängt.
5. Wartung unterdrückt keine sicherheitskritischen Alarme (AV-Threat, SMART) – nur Betriebsalarme.

## 3. Regeln

| ID | Regel | Bedingung | Unterdrückt | Konfidenz |
| --- | --- | --- | --- | --- |
| `agent-offline` | Agent berichtet nicht | Gerät offline, Alert ist agent-basiert, `lastContact` älter als Schwelle | CPU, Memory, Disk, Service, Event, Script, AV, Backup, Patch auf demselben Gerät | 0,99 |
| `parent-offline` | Host/Elternsystem offline | `parentDeviceId` zeigt auf offline Gerät | VM-Gast- und Agent-Alarme der Kinder | 0,96 |
| `network-path` | Netzwerkpfad ausgefallen | Switch/Router/Firewall am selben Standort offline | Ping, HTTP, Port, NMS-Traffic, Agent-Offline der betroffenen Geräte | 0,92 |
| `wan-outage` | WAN/Internet ausgefallen | Externes ISP-Signal oder Firewall + HTTP + mehrere Standortgeräte offline | Internetabhängige Checks (HTTP, externe DNS, Cloud), nicht lokale Hardware | 0,90 |
| `switch-down` | Switch ausgefallen | NMS-Switch/Router offline | Geräte hinter dem Switch (Topologie/Tag/Standort) | 0,94 |
| `maintenance` | Wartungsfenster | Gerät in Maintenance | Alle Betriebsalarme, außer kritische Sicherheit | 0,99 |
| `flapping` | Flapping | ≥ 3 Trigger/Resets in 15 min | Keine Unterdrückung, aber Prioritätsabschlag und Kennzeichnung | 0,80 |
| `external-signal` | Manuelles Signal | Aktives Signal mit passendem Scope | Abhängig von Signaltyp und Wirkung | 0,85 |
| `dependency` | Fachliche Abhängigkeit | z. B. Disk voll vor Backup-Fehler | Keine Unterdrückung; Link als „beitragende Ursache“ | 0,70 |

### Reihenfolge

1. Root Causes bestimmen (offline Geräte, aktive externe Signale, Wartung).
2. Root-Cause-Alarme markieren und schützen.
3. Für jeden Nicht-Root-Alarm Regeln in Prioritätsreihenfolge prüfen:
   `maintenance` → `wan-outage` → `switch-down` → `network-path` → `parent-offline` → `agent-offline` → `external-signal`.
4. Erste Regel mit Konfidenz ≥ Schwelle gewinnt; weitere Treffer werden als Evidenz gespeichert.
5. Incidents aus Root Cause + unterdrückten Alarmen + betroffenen Geräten bilden.
6. Empfohlene Aufgabe und Priorität ableiten.

## 4. Beispiel A — WAN-Ausfall Bremen

**Signale**

- Externes Signal `ISP` für Location Bremen, aktiv.
- Firewall `FW-BRE-01` offline, Switch `SW-BRE-01` offline.
- 7 Geräte offline, 4 HTTP-Checks rot, 2 Ping-Checks rot.

**Ergebnis**

```text
Incident: WAN-Ausfall Bremen
Root Cause: Externes ISP-Signal + FW-BRE-01 offline
Impact: 13 Alarme, 7 Geräte, 1 Standort
Confidence: 0,90
Suppression: 11 Alarme
Empfehlung: "ISP kontaktieren, WAN-Uplink und Firewall prüfen; lokale Geräte erst nach WAN-Recovery bewerten."
```

Nicht unterdrückt:

- SMART-Fehler auf `SRV-BRE-FILE` (lokale Hardware),
- AV-Bedrohung (Sicherheit),
- ein einzelner Spooler-Alarm, sofern er nicht durch Offline erklärt ist.

## 5. Beispiel B — Switch-Ausfall Hamburg

**Signale**

- `SW-CORE-01` offline, `parentDeviceId`-Kette und Standort-Tag Hamburg.
- 9 Geräte im selben Standort offline, davon 6 mit Agent, 3 NMS.

**Ergebnis**

- Root Cause: `SW-CORE-01`.
- Unterdrückt: 6 Agent-Offline, 3 Ping, 2 HTTP.
- Nicht unterdrückt: ein Disk-Alarm auf einem Gerät, das noch online ist.
- Empfehlung: „Switch SW-CORE-01 prüfen: Strom, Uplink, SFP; danach Geräte neu bewerten.“

## 6. Beispiel C — Host offline, VMs offline

`ESX-02` offline, `VM-ERP-01`, `VM-SQL-02`, `VM-TEST-03` offline.

- Root Cause: `ESX-02`.
- VM-Alarme werden zu Symptomen.
- Confidence 0,96 über `parentDeviceId`.
- Empfehlung: Host prüfen, nicht drei separate VM-Tickets.

## 7. Beispiel D — Agent offline, aber Disk-Warnung

`SRV-FILE01` ist offline, letzte Disk-Warnung vor 40 Minuten.

- Disk-Warnung wird unterdrückt (nicht mehr belastbar), aber **nicht gelöscht**.
- Incident „Agent offline“ mit Hinweis: „Letzte Disk-Warnung 40 min alt; nach Reconnect prüfen.“
- Aufgabe: „Agent/FILE01 prüfen und Disk-Status nach Reconnect verifizieren.“

## 8. Externe Signale (NinjaOne-Blindspots)

NinjaOne kann einen WAN-Ausfall nicht zuverlässig als solchen melden, wenn die Verbindung zur Cloud betroffen ist. Signal erlaubt deshalb manuelle Signale:

| Typ | Scope | Wirkung |
| --- | --- | --- |
| `ISP` | Organisation oder Standort | Internetabhängige Checks unterdrücken, WAN-Task erzeugen |
| `POWER` | Standort | Alle Geräte des Standorts als Symptome, Strom-Task |
| `SWITCH` | Gerät oder Standort | Downstream-Geräte unterdrücken, Switch-Task |
| `MAINTENANCE` | Gerät/Standort | Betriebsalarme unterdrücken, Security ausgenommen |
| `OTHER` | frei | nur dokumentieren / manuell verknüpfen |

Signale haben Start, optionales Ende, Status (`active`, `resolved`), Notiz und Effekt-Flags. Sie sind auditierbar und sofort wirksam.

## 9. Prioritätsberechnung

1. Basispriorität aus Severity-Matrix (editierbar):

| Severity | Default |
| --- | --- |
| CRITICAL | P1 |
| MAJOR | P2 |
| MODERATE | P3 |
| MINOR | P4 |
| NONE | P4 |

2. Regeln (höchste gewinnt):
   - `AGENT_OFFLINE` + Server → P1
   - `CONDITION_SMART_STATUS_DEGRADED` → P1
   - `AV_*` → P1
   - `CONDITION_AGENT_DISK_FREE_SPACE` < 5 % → P1
   - `CONDITION_WINDOWS_SERVICE_STATE_CHANGED` auf Produktionsserver → P2
   - Alter > 60 min → +1 Stufe
   - Flapping → −1 Stufe
   - Maintenance → P4 (Security ausgenommen)
3. Manueller Override pro Alarm gewinnt immer.
4. Score = Prioritätsgewicht + Alter + Impact + Konfidenz (nur Sortierung).

## 10. Grenzen

- Die Public API liefert keine Switch-Port-Topologie; Signal nutzt Parent, Standort, Tags und manuelle Signale.
- Kausalität ist heuristisch, nicht bewiesen. Deshalb Konfidenz, Evidenz und Transparenz.
- Ohne Historie keine Zeitmuster; M4 ergänzt Persistenz und Lernen.
- Externe Signale sind manuell; eine Netzwerk-Sonde/ISP-API ist eine mögliche Erweiterung.
