import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/use-auth";
import { CATEGORIES, CATEGORY_LABEL, fmtCurrency, fmtDateShort, type Category, type Transaction } from "@/lib/finance";
import { importTransactions } from "@/lib/transactions.functions";

export const Route = createFileRoute("/_authenticated/app/transactions")({
  head: () => ({ meta: [{ title: "Ledger — FinSight AI" }] }),
  component: TxnsPage,
});

function TxnsPage() {
  const { user } = useSupabaseSession();
  const qc = useQueryClient();
  const importFn = useServerFn(importTransactions);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("txn_date", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []).map(d => ({ ...d, amount: Number(d.amount) })) as Transaction[];
    },
  });

  // Manual entry form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["transactions"] });

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      toast.error("Enter a non-zero amount (negative for expenses)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      txn_date: date,
      description: desc,
      merchant: merchant || null,
      amount: amt,
      category,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transaction added");
    setDesc(""); setMerchant(""); setAmount("");
    refresh();
  };

  const onCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows: Array<{ txn_date: string; description: string; merchant: string | null; amount: number }> = [];
        for (const r of res.data as Record<string, string>[]) {
          const dateRaw = pick(r, ["date", "txn_date", "transaction date", "posted date"]);
          const descRaw = pick(r, ["description", "memo", "narrative", "details"]);
          const amtRaw = pick(r, ["amount", "value", "debit", "credit"]);
          const mer = pick(r, ["merchant", "payee"]) ?? null;
          if (!dateRaw || !descRaw || !amtRaw) continue;
          const parsedDate = normalizeDate(dateRaw);
          const amt = parseFloat(String(amtRaw).replace(/[$,]/g, ""));
          if (!parsedDate || !Number.isFinite(amt)) continue;
          rows.push({ txn_date: parsedDate, description: descRaw, merchant: mer, amount: amt });
        }
        if (rows.length === 0) { toast.error("No valid rows found"); return; }
        if (rows.length > 500) {
          toast.error("Maximum 500 rows per import");
          return;
        }
        setBusy(true);
        try {
          const result = await importFn({ data: { rows } });
          toast.success(`Imported ${result.inserted} transactions and categorized via AI`);
          refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed");
        } finally {
          setBusy(false);
          if (fileRef.current) fileRef.current.value = "";
        }
      },
      error: (err) => toast.error(err.message),
    });
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto animate-reveal">
      <div className="mb-8">
        <p className="label-eyebrow text-muted-foreground mb-2">Ledger</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Transactions</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Manual entry */}
        <form onSubmit={onAdd} className="lg:col-span-2 bg-background border border-border p-6 space-y-4">
          <h2 className="label-eyebrow">Manual entry</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Date">
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Amount (negative = expense)">
              <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="-42.50" className={inputCls} />
            </Field>
            <Field label="Description">
              <input type="text" required maxLength={200} value={desc} onChange={e => setDesc(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Merchant (optional)">
              <input type="text" maxLength={120} value={merchant} onChange={e => setMerchant(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Category">
              <select value={category} onChange={e => setCategory(e.target.value as Category)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </Field>
          </div>
          <button type="submit" disabled={busy} className="px-5 py-2.5 bg-foreground text-background text-xs font-bold tracking-widest hover:bg-accent transition-colors disabled:opacity-50">
            {busy ? "…" : "ADD TRANSACTION"}
          </button>
        </form>

        {/* CSV upload */}
        <div className="bg-secondary border-l-4 border-accent p-6 flex flex-col">
          <h2 className="label-eyebrow mb-3">Import CSV</h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            Columns: date, description, amount (and optional merchant). AI will auto-categorize on import.
          </p>
          <label className="border-2 border-dashed border-foreground/15 px-4 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium tracking-widest">DROP CSV HERE</span>
            <span className="px-3 py-1 bg-foreground text-background text-[10px] font-bold tracking-wider">BROWSE FILES</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} disabled={busy} />
          </label>
          <p className="mt-auto pt-6 text-[10px] tracking-widest text-muted-foreground">PROCESSED IN SECONDS · 500 ROWS MAX</p>
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-background border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-foreground text-background flex justify-between items-center">
          <span className="label-eyebrow">Ledger · {txns.length} entries</span>
          <span className="text-[10px] opacity-50">SORTED NEWEST FIRST</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No transactions yet. Add one above or upload a CSV.</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary sticky top-0">
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground">
                  <th className="py-2 px-5">DATE</th>
                  <th className="py-2 px-2">DESCRIPTION</th>
                  <th className="py-2 px-2">CATEGORY</th>
                  <th className="py-2 px-5 text-right">AMOUNT</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txns.map(t => (
                  <tr key={t.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-5 text-[10px] font-bold tracking-wider text-muted-foreground">{fmtDateShort(t.txn_date)}</td>
                    <td className="py-3 px-2">
                      <div className="text-xs font-medium">{t.description}</div>
                      {t.merchant && <div className="text-[10px] text-muted-foreground">{t.merchant}</div>}
                    </td>
                    <td className="py-3 px-2 text-[10px] uppercase tracking-wider">{CATEGORY_LABEL[t.category]}</td>
                    <td className={`py-3 px-5 text-right text-xs font-bold ${t.amount > 0 ? "text-accent" : ""}`}>
                      {fmtCurrency(t.amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => onDelete(t.id)} className="text-[10px] text-muted-foreground hover:text-destructive">DEL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-foreground/15 bg-background text-sm focus:outline-none focus:border-accent transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-eyebrow block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.toLowerCase().trim())) {
      const v = row[k];
      if (v != null && v !== "") return String(v).trim();
    }
  }
  return undefined;
}

function normalizeDate(s: string): string | null {
  // Accept YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY (assume US for slashes)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}
