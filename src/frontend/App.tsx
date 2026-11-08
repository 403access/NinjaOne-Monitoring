import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { NotFound } from "./pages/Placeholders";
import { Conditions } from "./pages/Conditions";
import { Alerts } from "./pages/Alerts";
import { Causality } from "./pages/Causality";
import { Tasks } from "./pages/Tasks";
import { Devices } from "./pages/Devices";
import { Settings } from "./pages/Settings";
import { Dashboard } from "./pages/Dashboard";
import { Button } from "./components/ui/Primitives";

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-screen__mark">S</div>
      <h1>Signal wird geladen</h1>
      <p>NinjaOne-Daten und Kausalität werden aufbereitet …</p>
      <div className="boot-screen__bar">
        <span />
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  const { refresh } = useApp();
  return (
    <div className="boot-screen boot-screen--error">
      <AlertCircle size={36} aria-hidden />
      <h1>Verbindung fehlgeschlagen</h1>
      <p>{message}</p>
      <Button icon={RefreshCw} onClick={() => void refresh()}>
        Erneut versuchen
      </Button>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { loading, error, payload } = useApp();
  if (loading && !payload) return <LoadingScreen />;
  if (error && !payload) return <ErrorScreen message={error} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <Gate>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="causality" element={<Causality />} />
                <Route path="conditions" element={<Conditions />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="devices" element={<Devices />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Gate>
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  );
}
