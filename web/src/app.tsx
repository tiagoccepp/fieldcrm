import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, type Me } from "./lib/api";
import { flush, useOnline, useOutbox } from "./lib/outbox";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SyncDrawer } from "./components/SyncDrawer";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { JobsPage } from "./pages/Jobs";
import { JobDetailPage } from "./pages/JobDetail";
import { NewJobPage } from "./pages/NewJob";
import { CustomersPage } from "./pages/Customers";
import { FollowupsPage } from "./pages/Followups";
import { StatsPage } from "./pages/Stats";

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const online = useOnline();
  const outbox = useOutbox();
  const [drawer, setDrawer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const off = () => {};
    void off;
    return undefined;
  }, []);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="bg-side p-4 text-white">
        <p className="text-lg font-bold">
          FieldCRM <span className="text-xs font-normal text-accent-dk">demo</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-accent-dk">{me.orgName}</p>
        <nav className="mt-6 grid gap-1 text-sm" aria-label="Primary">
          {[
            ["/dashboard", "Dashboard"],
            ["/jobs", "Jobs"],
            ["/customers", "Customers"],
            ["/followups", "Follow-ups"],
            ["/stats", "Stats"],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="rounded px-3 py-2 hover:bg-white/10">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-white/15 pt-4 text-xs">
          <p className="font-semibold">{me.name}</p>
          <p className="text-accent-dk">
            {me.role} · {me.email}
          </p>
          <button onClick={onLogout} className="mt-2 underline hover:no-underline">
            Sign out
          </button>
        </div>
      </aside>
      <div>
        <div className="border-b border-warn/30 bg-warn/10 px-4 py-1 text-center text-xs font-semibold text-warn" role="note">
          Demo data — fictional window-cleaning shop, all names and numbers invented
        </div>
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-2">
          <p className="text-sm text-muted">
            {online ? "● Online" : "○ Offline — writes queue locally"}
          </p>
          <button
            onClick={() => setDrawer(true)}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${outbox.length > 0 ? "border-warn/40 bg-warn/10 text-warn bump" : "border-line text-muted"}`}
            aria-label={`Sync queue, ${outbox.length} pending`}
            key={outbox.length}
          >
            Sync: {outbox.length}
          </button>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-6">
          <ErrorBoundary>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage refreshKey={refreshKey} />} />
              <Route path="/jobs" element={<JobsPage me={me} refreshKey={refreshKey} />} />
              <Route path="/jobs/new" element={<NewJobPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage refreshKey={refreshKey} />} />
              <Route path="/customers" element={<CustomersPage me={me} />} />
              <Route path="/followups" element={<FollowupsPage me={me} />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <SyncDrawer open={drawer} onClose={() => setDrawer(false)} onSync={() => setRefreshKey((k) => k + 1)} />
      </div>
    </div>
  );
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const nav = useNavigate();

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/auth/me"));
    } catch {
      setMe(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
    void flush();
  }, [refreshMe]);

  async function logout(): Promise<void> {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    nav("/login");
  }

  if (!checked) return <p className="p-8 text-muted">Loading…</p>;
  if (!me) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={() => void refreshMe()} />} />
      </Routes>
    );
  }
  return <Shell me={me} onLogout={() => void logout()} />;
}
