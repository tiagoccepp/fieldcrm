import { useEffect, useState } from "react";
import { api, type Customer, type Me } from "../lib/api";
import { Button, Card, Dialog, Empty, Field, Input } from "../components/ui";

export function CustomersPage({ me }: { me: Me }) {
  const [rows, setRows] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const canEdit = me.role === "owner" || me.role === "dispatcher";

  useEffect(() => {
    api<Customer[]>("/api/customers").then(setRows).catch(() => {});
  }, []);

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const row = await api<Customer>("/api/customers", { method: "POST", json: { name, phone, address } });
    setRows((r) => [...r, row].sort((a, b) => a.name.localeCompare(b.name)));
    setOpen(false);
    setName("");
    setPhone("");
    setAddress("");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        {canEdit && <Button onClick={() => setOpen(true)}>New customer</Button>}
      </div>
      {rows.length === 0 ? (
        <Empty>No customers yet.</Empty>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="hidden p-3 md:table-cell">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-paper">
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="mono p-3">{c.phone || "—"}</td>
                  <td className="hidden p-3 md:table-cell">{c.address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {open && (
        <Dialog title="New customer" onClose={() => setOpen(false)}>
          <form onSubmit={(e) => void create(e)} className="grid gap-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 303-555-0100" />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Button type="submit">Create customer</Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
