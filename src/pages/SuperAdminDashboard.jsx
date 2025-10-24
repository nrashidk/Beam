import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, RefreshCcw, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// Mock fetch function
async function fetchStats(fromISO, toISO) {
  const companies = Array.from({ length: 42 }).map((_, i) => ({
    id: \`c\${i + 1}\`,
    name: \`Company \${i + 1}\`,
    status: i % 8 === 0 ? "inactive" : "active",
    invoicesThisMonth: 420 - i * 5,
    invoicesLimit: 1000,
    plan: i % 10 < 3 ? "Enterprise" : i % 10 < 7 ? "Professional" : i % 10 < 9 ? "Starter" : "Free",
    arpu: i % 10 < 3 ? 899 : i % 10 < 7 ? 299 : i % 10 < 9 ? 99 : 0,
    region: ["DXB", "AUH", "SHJ"][i % 3],
    vatCompliant: i % 11 !== 0,
  }));

  const tierDefs = [
    { plan: "Enterprise", pricePerCompany: 899 },
    { plan: "Professional", pricePerCompany: 299 },
    { plan: "Starter", pricePerCompany: 99 },
    { plan: "Free", pricePerCompany: 0 },
  ];
  const tiers = tierDefs.map((t) => {
    const activeCompanies = companies.filter((c) => c.plan === t.plan && c.status === "active").length;
    const mrr = activeCompanies * t.pricePerCompany;
    return {
      plan: t.plan,
      activeCompanies,
      pricePerCompany: t.pricePerCompany,
      mrr,
      arr: mrr * 12,
      newActivations: Math.max(0, Math.round(activeCompanies * 0.06)),
    };
  });
  const mrr = tiers.reduce((a, b) => a + b.mrr, 0);
  const monthToDate = companies.reduce((a, c) => a + c.invoicesThisMonth, 0);
  const lastMonth = Math.round(monthToDate * 0.92);

  return {
    asOf: new Date().toISOString(),
    registrations: { pending: 18, approved: 1247, rejected: 32 },
    companies: { active: companies.filter((c) => c.status === "active").length, inactive: companies.filter((c) => c.status === "inactive").length, all: companies },
    invoices: { monthToDate, lastMonth },
    revenue: { mrr, arr: mrr * 12, deltaPctVsLastMonth: 7.8, tiers },
  };
}

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCompaniesCsv(rows) {
  const header = ["Company", "Status", "Plan", "ARPU", "InvoicesMTD", "Region", "VATCompliant"];
  const lines = rows.map((r) => [
    csvEscape(r.name), csvEscape(r.status), csvEscape(r.plan || ""), csvEscape(r.arpu ?? ""),
    csvEscape(r.invoicesThisMonth), csvEscape(r.region || ""), csvEscape(r.vatCompliant ? "Yes" : "No")
  ].join(","));
  return [header.join(","), ...lines].join("\n");
}

function Stat({ label, value, delta, positive }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between">
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
          {delta && <div className={\`flex items-center gap-1 text-xs \${positive ? "text-emerald-600" : "text-rose-600"}\`}>
            {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}<span>{delta}</span>
          </div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children, action }) {
  return <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2>{action}</div>{children}</div>;
}

function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-6 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="outline" size="icon" onClick={onClose}><X size={16} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [range, setRange] = useState({ from: new Date(new Date().setDate(new Date().getDate() - 29)), to: new Date() });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [minInvoices, setMinInvoices] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  function handleSignOut() { logout(); navigate('/login'); }
  function exportCompaniesCsv(rows) {
    const csv = buildCompaniesCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = \`companies-\${new Date().toISOString().slice(0, 10)}.csv\`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fromISO = useMemo(() => range.from.toISOString(), [range.from]);
  const toISO = useMemo(() => range.to.toISOString(), [range.to]);

  useEffect(() => {
    setLoading(true);
    fetchStats(fromISO, toISO).then((data) => { setStats(data); setLoading(false); });
  }, [fromISO, toISO]);

  const mtdDelta = useMemo(() => {
    if (!stats) return { pct: "", positive: true };
    const { monthToDate, lastMonth } = stats.invoices;
    const delta = lastMonth === 0 ? 0 : ((monthToDate - lastMonth) / lastMonth) * 100;
    return { pct: \`\${delta > 0 ? "+" : ""}\${delta.toFixed(1)}% vs last month\`, positive: delta >= 0 };
  }, [stats]);

  const filteredCompanies = useMemo(() => {
    const list = stats?.companies.all || [];
    const ql = q.trim().toLowerCase();
    return list.filter((c) => {
      if (plan !== "all" && c.plan !== plan) return false;
      if (status !== "all" && c.status !== status) return false;
      if (minInvoices && c.invoicesThisMonth < Number(minInvoices)) return false;
      if (ql && !\`\${c.name}\`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [stats, q, plan, status, minInvoices]);

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Super Admin Overview</h1>
          <p className="text-sm text-muted-foreground">As of {stats ? format(new Date(stats.asOf), "PPpp") : "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleSignOut}>Logout</Button>
          <Button variant="outline" className="gap-2" onClick={() => setRange({ from: new Date(new Date().setDate(new Date().getDate() - 29)), to: new Date() })}>
            <RefreshCcw size={16} />Reset Range
          </Button>
          <Button variant="secondary" className="gap-2" disabled>
            <CalendarIcon size={16} />{format(range.from, "MMM d")} – {format(range.to, "MMM d, yyyy")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending registrations" value={loading ? "—" : stats?.registrations.pending ?? "—"} />
        <Stat label="Approved registrations" value={loading ? "—" : stats?.registrations.approved ?? "—"} />
        <Stat label="Rejected registrations" value={loading ? "—" : stats?.registrations.rejected ?? "—"} />
        <Stat label="Active companies" value={loading ? "—" : stats?.companies.active ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Stat label="Inactive companies" value={loading ? "—" : stats?.companies.inactive ?? "—"} />
          <Stat label="Invoices month‑to‑date" value={loading ? "—" : stats?.invoices.monthToDate.toLocaleString() ?? "—"} delta={mtdDelta.pct} positive={mtdDelta.positive} />
        </div>

        <Card className="lg:col-span-2 rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base">Revenue summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Stat label="Total MRR" value={loading ? "—" : \`AED \${stats?.revenue.mrr.toLocaleString()}\`} />
              <Stat label="Total ARR" value={loading ? "—" : \`AED \${stats?.revenue.arr.toLocaleString()}\`} delta={\`\${stats?.revenue.deltaPctVsLastMonth > 0 ? "+" : ""}\${stats?.revenue.deltaPctVsLastMonth.toFixed(1)}% MoM\`} positive={(stats?.revenue.deltaPctVsLastMonth || 0) >= 0} />
              <Stat label="Enterprise MRR" value={loading ? "—" : \`AED \${stats?.revenue.tiers.find((t) => t.plan === "Enterprise")?.mrr.toLocaleString() ?? 0}\`} />
              <Stat label="Professional MRR" value={loading ? "—" : \`AED \${stats?.revenue.tiers.find((t) => t.plan === "Professional")?.mrr.toLocaleString() ?? 0}\`} />
            </div>
            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Active companies</th>
                    <th className="px-4 py-3 font-medium">New activations</th>
                    <th className="px-4 py-3 font-medium">Price / company</th>
                    <th className="px-4 py-3 font-medium">MRR</th>
                    <th className="px-4 py-3 font-medium">ARR</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.revenue.tiers || []).map((t) => (
                    <tr key={t.plan} className="border-t">
                      <td className="px-4 py-3">{t.plan}</td>
                      <td className="px-4 py-3">{t.activeCompanies.toLocaleString()}</td>
                      <td className="px-4 py-3">{t.newActivations.toLocaleString()}</td>
                      <td className="px-4 py-3">AED {t.pricePerCompany.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">AED {t.mrr.toLocaleString()}</td>
                      <td className="px-4 py-3">AED {t.arr.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Section title="Company Explorer" action={
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2" size={16} />
              <Input className="pl-8" placeholder="Search company name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Free">Free</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={0} placeholder="Min invoices" value={minInvoices} onChange={(e) => setMinInvoices(e.target.value)} className="w-[140px]" />
              <Button variant="outline" className="gap-2" onClick={() => setShowFilters(true)}><Filter size={16} />More filters</Button>
              <Button variant="outline" onClick={() => exportCompaniesCsv(filteredCompanies)}>Export CSV</Button>
            </div>
          </div>
        }>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">ARPU</th>
                <th className="px-4 py-3 font-medium">Invoices (MTD)</th>
                <th className="px-4 py-3 font-medium">VAT</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={\`inline-flex items-center rounded-full px-2 py-0.5 text-xs \${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}\`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">{c.plan || "—"}</td>
                  <td className="px-4 py-3">{c.arpu ? \`AED \${c.arpu}\` : "—"}</td>
                  <td className="px-4 py-3">{c.invoicesThisMonth.toLocaleString()}</td>
                  <td className="px-4 py-3">{c.vatCompliant ? <Badge className="bg-emerald-600">Compliant</Badge> : <Badge variant="secondary">Review</Badge>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">View analytics</Button>
                      <Button size="sm" variant="outline">Open profile</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Showing {filteredCompanies.length} of {stats?.companies.all.length || 0} companies</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base">Operational quick actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline">Review pending registrations</Button>
            <Button variant="outline">Export monthly report</Button>
            <Button variant="outline">Manage plans & limits</Button>
            <Button variant="outline">Open audit logs</Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base">System Notes</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-2 text-muted-foreground">
              <li>Revenue summary updates automatically as tier activations change (MRR/ARR computed per plan).</li>
              <li>Company Explorer exposes search and filters for detailed analysis.</li>
              <li>All subscription tiers: Free, Starter, Professional, Enterprise.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Drawer open={showFilters} onClose={() => setShowFilters(false)} title="Advanced filters">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Region</label>
              <Select defaultValue="all">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="DXB">Dubai (DXB)</SelectItem>
                  <SelectItem value="AUH">Abu Dhabi (AUH)</SelectItem>
                  <SelectItem value="SHJ">Sharjah (SHJ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">VAT compliance</label>
              <Select defaultValue="all">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ok">Compliant</SelectItem>
                  <SelectItem value="review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Min ARPU (AED)</label>
              <Input type="number" placeholder="e.g. 300" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Joined after</label>
              <Input type="date" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowFilters(false)}>Cancel</Button>
            <Button onClick={() => setShowFilters(false)}>Apply</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
