import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, Field, Input } from "../components/ui";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("luis@blueridge.example");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      onLogin();
      nav("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-sm px-4">
      <div className="mb-6 text-center">
        <p className="mono text-xs uppercase tracking-widest text-muted">Blue Ridge Plumbing · demo</p>
        <h1 className="mt-1 text-3xl font-bold">FieldCRM</h1>
        <p className="mt-1 text-sm text-muted">Jobs, customers and follow-ups — online or off.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
      <p className="mono mt-4 text-center text-xs text-muted">
        dispatcher luis@blueridge.example · tech sam@blueridge.example · Demo1234!
      </p>
    </div>
  );
}
