import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Customer } from "../lib/api";
import { Button, Card, Field, Input } from "../components/ui";

export function NewJobPage() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [price, setPrice] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Customer[]>("/api/customers").then(setCustomers).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const job = await api<{ id: string }>("/api/jobs", {
        method: "POST",
        json: {
          title,
          customerId,
          priceCents: Math.round(Number(price || 0) * 100),
          steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        },
      });
      nav(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">New job</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Water heater replacement" required />
          </Field>
          <Field label="Customer">
            <select
              className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Price (USD)">
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="450" />
          </Field>
          <Field label="Checklist steps (one per line)">
            <textarea
              className="w-full rounded-md border border-line bg-card px-3 py-2 text-sm"
              rows={4}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={"Diagnose\nFix\nVerify"}
            />
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <Button type="submit" disabled={busy || !customerId || !title.trim()}>
            {busy ? "Creating…" : "Create job"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
