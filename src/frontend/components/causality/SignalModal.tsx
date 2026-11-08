import { CloudOff, RadioTower, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SIGNAL_TYPE_LABEL } from "../../../shared/constants";
import type { Device, ExternalSignal, Location, Organization, SignalEffects, SignalScope, SignalType } from "../../../shared/types";
import { Modal } from "../ui/Overlay";
import { Button, Toggle } from "../ui/Primitives";

function defaultsFor(type: SignalType): SignalEffects {
  if (type === "ISP") return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: false };
  if (type === "POWER" || type === "SWITCH" || type === "MAINTENANCE") {
    return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true };
  }
  return { suppressInternetChecks: false, suppressNetworkChecks: false, suppressAgentAlerts: false };
}

export function SignalModal({
  open,
  onClose,
  onSubmit,
  organizations,
  locations,
  devices,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: SignalType;
    title: string;
    scope: SignalScope;
    notes: string;
    effects: SignalEffects;
  }) => Promise<ExternalSignal | undefined>;
  organizations: Organization[];
  locations: Location[];
  devices: Device[];
}) {
  const [type, setType] = useState<SignalType>("ISP");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<SignalScope["level"]>("location");
  const [organizationId, setOrganizationId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [notes, setNotes] = useState("");
  const [effects, setEffects] = useState<SignalEffects>(defaultsFor("ISP"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("ISP");
    setTitle("");
    setLevel("location");
    setOrganizationId(organizations[0] ? String(organizations[0].id) : "");
    setLocationId(locations[0] ? String(locations[0].id) : "");
    setDeviceId(devices[0] ? String(devices[0].id) : "");
    setNotes("");
    setEffects(defaultsFor("ISP"));
  }, [open, organizations, locations, devices]);

  const filteredLocations = useMemo(
    () => locations.filter((location) => !organizationId || String(location.organizationId) === organizationId),
    [locations, organizationId],
  );
  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          (!organizationId || String(device.organizationId) === organizationId) &&
          (!locationId || String(device.locationId) === locationId),
      ),
    [devices, organizationId, locationId],
  );

  const scope: SignalScope | undefined = useMemo(() => {
    if (level === "organization") {
      const organization = organizations.find((entry) => String(entry.id) === organizationId);
      return organization ? { level, organizationId: organization.id, label: organization.name } : undefined;
    }
    if (level === "location") {
      const location = locations.find((entry) => String(entry.id) === locationId);
      return location ? { level, locationId: location.id, organizationId: location.organizationId, label: location.name } : undefined;
    }
    const device = devices.find((entry) => String(entry.id) === deviceId);
    return device
      ? { level, deviceId: device.id, locationId: device.locationId, organizationId: device.organizationId, label: device.displayName }
      : undefined;
  }, [level, organizations, organizationId, locations, locationId, devices, deviceId]);

  const changeType = (next: SignalType) => {
    setType(next);
    setEffects(defaultsFor(next));
    if (!title.trim()) {
      const labels: Record<SignalType, string> = {
        ISP: "ISP-/WAN-Ausfall",
        POWER: "Stromausfall",
        SWITCH: "Switch-Ausfall",
        MAINTENANCE: "Wartungsfenster",
        OTHER: "Externe Störung",
      };
      setTitle(labels[next]);
    }
  };

  const submit = async () => {
    if (!scope) return;
    setSaving(true);
    const result = await onSubmit({ type, title: title.trim() || `${SIGNAL_TYPE_LABEL[type]}`, scope, notes, effects });
    setSaving(false);
    if (result) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Externes Signal melden"
      subtitle="Für Störungen, die NinjaOne nicht sehen kann – z. B. ISP, Strom oder ein Switch ohne Monitoring."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={RadioTower} loading={saving} onClick={() => void submit()} disabled={!scope || !title.trim()}>
            Signal aktivieren
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Signaltyp</span>
          <select value={type} onChange={(event) => changeType(event.target.value as SignalType)}>
            {Object.entries(SIGNAL_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Titel</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. ISP-Ausfall Bremen" />
        </label>
        <label className="field">
          <span>Scope</span>
          <select
            value={level}
            onChange={(event) => {
              const next = event.target.value as SignalScope["level"];
              setLevel(next);
              if (next === "organization") setLocationId("");
            }}
          >
            <option value="organization">Organisation</option>
            <option value="location">Standort</option>
            <option value="device">Gerät</option>
          </select>
        </label>
        <label className="field">
          <span>Organisation</span>
          <select
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setLocationId("");
              setDeviceId("");
            }}
          >
            <option value="">Alle Organisationen</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        {level !== "organization" ? (
          <label className="field">
            <span>Standort</span>
            <select
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value);
                setDeviceId("");
              }}
            >
              <option value="">Alle Standorte</option>
              {filteredLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {level === "device" ? (
          <label className="field">
            <span>Gerät</span>
            <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
              <option value="">Gerät wählen</option>
              {filteredDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.displayName} · {device.locationName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field form-grid__full">
          <span>Notiz / Ticketreferenz</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="z. B. Provider-Ticket ISP-88421, ETA 14:30, Ansprechpartner …"
          />
        </label>
      </div>

      <div className="signal-effects">
        <div className="signal-effects__header">
          <CloudOff size={15} aria-hidden />
          <div>
            <strong>Wirkung auf die Kausalität</strong>
            <span>Diese Alarme werden als Symptome behandelt, solange das Signal aktiv ist.</span>
          </div>
        </div>
        <Toggle
          checked={effects.suppressInternetChecks}
          onChange={(next) => setEffects((current) => ({ ...current, suppressInternetChecks: next }))}
          label="Internetabhängige Checks"
          description="HTTP, externe DNS- und Cloud-Erreichbarkeit"
        />
        <Toggle
          checked={effects.suppressNetworkChecks}
          onChange={(next) => setEffects((current) => ({ ...current, suppressNetworkChecks: next }))}
          label="Netzwerk-Checks"
          description="Ping, Ports, SNMP, NMS-Traffic und Adapterstatus"
        />
        <Toggle
          checked={effects.suppressAgentAlerts}
          onChange={(next) => setEffects((current) => ({ ...current, suppressAgentAlerts: next }))}
          label="Agent-Alarme"
          description="CPU, Memory, Disk, Dienste und Events betroffener Geräte"
        />
      </div>

      <div className="signal-preview">
        <Zap size={14} aria-hidden />
        <span>
          Scope: <strong>{scope?.label ?? "—"}</strong> · Wirkung:{" "}
          {[
            effects.suppressInternetChecks ? "Internet" : null,
            effects.suppressNetworkChecks ? "Netzwerk" : null,
            effects.suppressAgentAlerts ? "Agent" : null,
          ]
            .filter(Boolean)
            .join(", ") || "nur dokumentieren"}
        </span>
      </div>
    </Modal>
  );
}
