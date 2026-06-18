import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  fmtCurrency,
  fmtDateShort,
  type Category,
  type Transaction,
} from "@/lib/finance";
import {
  computeHealthScore,
  monthlyCashflow,
  scoreLabel,
  spendByCategory,
} from "@/lib/health-score";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — FinSight AI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useSupabaseSession();
  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("txn_date", since.toISOString().slice(0, 10))
        .order("txn_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => ({ ...d, amount: Number(d.amount) })) as Transaction[];
    },
  });

  const health = computeHealthScore(txns);
  const cashflow = monthlyCashflow(txns);
  const byCat = spendByCategory(txns).slice(0, 6);
  const maxCat = byCat[0]?.amount ?? 0;

  if (!isLoading && txns.length === 0) return <EmptyState />;

  return (
    <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto animate-reveal">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label-eyebrow text-muted-foreground mb-2">Portfolio Pulse</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">Overview, last 90 days</h1>
        </div>
        <div className="hidden md:flex items-baseline gap-1">
          <span className="text-3xl font-mono font-medium tracking-tighter">
            {fmtCurrency(health.income - health.expenses)}
          </span>
          <span className="label-eyebrow text-accent">NET</span>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-12 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
      >
        {/* Health score */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          className="col-span-12 lg:col-span-4 bg-background border border-border p-8 flex flex-col items-center justify-center relative hover:shadow-md transition-shadow"
        >
          <div className="absolute top-4 left-4 label-eyebrow text-muted-foreground italic">
            Health Metric v1
          </div>
          <ScoreRing score={health.total} />
          <p className="mt-6 text-xs text-center text-muted-foreground leading-relaxed max-w-[24ch]">
            Savings {health.savings}/40 · Stability {health.stability}/20 · Balance {health.balance}
            /20 · Cashflow {health.positivity}/20
          </p>
        </motion.div>

        {/* Spending breakdown */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          className="col-span-12 lg:col-span-8 bg-background border border-border p-8 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="label-eyebrow">Categorical Burn</h3>
            <Link
              to="/app/transactions"
              className="text-xs font-medium text-accent hover:underline"
            >
              View ledger →
            </Link>
          </div>
          {byCat.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-5">
              {byCat.map((row) => (
                <div key={row.category} className="space-y-2 group">
                  <div className="flex justify-between text-xs font-medium italic group-hover:text-accent transition-colors">
                    <span>{CATEGORY_LABEL[row.category as Category] ?? row.category}</span>
                    <span>{fmtCurrency(-row.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={
                        row.category === "investments" ? "h-full bg-accent" : "h-full bg-foreground"
                      }
                      style={{ width: `${maxCat ? (row.amount / maxCat) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Cash flow chart */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          className="col-span-12 lg:col-span-6 bg-background border border-border p-8 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="label-eyebrow">Net Cash Flow / 6 months</h3>
            <div className="flex gap-3">
              <Legend dot="bg-accent" label="In" />
              <Legend dot="bg-foreground" label="Out" />
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow} barGap={2}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--color-stone)" }}
                  contentStyle={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 0,
                    fontSize: 11,
                  }}
                  formatter={(v: number) => fmtCurrency(v)}
                />
                <Bar dataKey="income" fill="var(--color-brand)" />
                <Bar dataKey="expense" fill="var(--color-ink)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Budget Progress Card */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          className="col-span-12 lg:col-span-6 bg-background border border-border p-8 hover:shadow-md transition-shadow"
        >
          <BudgetSection user={user} txns={txns} />
        </motion.div>

        {/* Recent ledger */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          className="col-span-12 bg-background border border-border overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="p-4 border-b border-border bg-foreground text-background flex justify-between items-center">
            <span className="label-eyebrow">Recent Ledger</span>
            <Link to="/app/transactions" className="text-[10px] opacity-70 hover:opacity-100">
              VIEW ALL →
            </Link>
          </div>
          <table className="w-full text-left">
            <tbody className="divide-y divide-border">
              {txns.slice(0, 5).map((t) => (
                <tr key={t.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="py-3 px-5 text-[10px] font-bold tracking-wider text-muted-foreground">
                    {fmtDateShort(t.txn_date)}
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-xs font-medium truncate">
                      {t.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABEL[t.category]}
                    </div>
                  </td>
                  <td
                    className={`py-3 px-5 text-right text-xs font-bold ${t.amount > 0 ? "text-accent" : ""}`}
                  >
                    {fmtCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </motion.div>

      <div className="mt-12 grid md:grid-cols-2 gap-6">
        <Link
          to="/app/advisor"
          className="bg-foreground text-background p-6 flex items-center justify-between hover:bg-accent transition-colors group"
        >
          <div>
            <p className="label-eyebrow text-background/60 mb-2">AI Advisor</p>
            <h3 className="font-display text-xl font-bold tracking-tight">
              Ask anything about your money →
            </h3>
          </div>
        </Link>
        <Link
          to="/app/transactions"
          className="bg-accent text-background p-6 flex items-center justify-between hover:opacity-90 transition-opacity"
        >
          <div>
            <p className="label-eyebrow text-background/70 mb-2">Ledger</p>
            <h3 className="font-display text-xl font-bold tracking-tight">
              Add or import transactions →
            </h3>
          </div>
        </Link>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`size-2 ${dot}`} />
      <span className="text-[10px] font-bold tracking-widest">{label}</span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  // Animated count-up
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const total = 40;
    const id = setInterval(() => {
      frame++;
      setDisplay(Math.round((score * frame) / total));
      if (frame >= total) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [score]);

  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative size-48">
      <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          stroke="var(--color-stone)"
          strokeWidth="12"
        />
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="square"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-6xl font-black tabular-nums">{display}</span>
        <span className="label-eyebrow text-muted-foreground">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

function BudgetSection({ user, txns }: { user: any; txns: Transaction[] }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const expenseCategories = CATEGORIES.filter((c) => c !== "income");

  // Local state for editing limits
  const [limits, setLimits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (budgets.length) {
      const initialLimits: Record<string, string> = {};
      budgets.forEach((b) => {
        initialLimits[b.category] = String(b.limit_amount);
      });
      setLimits(initialLimits);
    }
  }, [budgets]);

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthTxns = txns.filter((t) => t.txn_date.startsWith(currentMonthStr));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const upserts = Object.entries(limits)
        .filter(([, val]) => val.trim() !== "" && Number(val) > 0)
        .map(([cat, val]) => ({
          user_id: user.id,
          category: cat as Category,
          limit_amount: Number(val),
        }));

      // Delete removed budgets (empty or 0)
      const categoriesToDelete = expenseCategories.filter(
        (cat) => !limits[cat] || Number(limits[cat]) <= 0,
      );

      if (categoriesToDelete.length > 0) {
        await supabase
          .from("budgets")
          .delete()
          .in("category", categoriesToDelete)
          .eq("user_id", user.id);
      }

      if (upserts.length > 0) {
        const { error } = await supabase.from("budgets").upsert(upserts, {
          onConflict: "user_id,category",
        });
        if (error) throw error;
      }

      toast.success("Budgets updated successfully");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["budgets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update budgets");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading budgets…</div>;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <h3 className="label-eyebrow">Monthly Budget Burn</h3>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs font-semibold text-accent hover:underline bg-transparent border-none cursor-pointer"
        >
          {editing ? "Cancel" : "Manage Budgets"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
            {expenseCategories.map((cat) => (
              <div key={cat} className="space-y-1">
                <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground block">
                  {CATEGORY_LABEL[cat]}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No limit"
                  value={limits[cat] ?? ""}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [cat]: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-foreground/15 bg-background text-xs focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-foreground text-background text-xs font-bold tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {busy ? "SAVING..." : "SAVE BUDGETS"}
          </button>
        </form>
      ) : budgets.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground space-y-3">
          <p>No budgets set for this month yet.</p>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 border border-foreground/15 hover:bg-secondary text-[10px] font-bold tracking-widest uppercase transition-colors"
          >
            SET LIMITS
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {budgets.map((b) => {
            const spent = Math.abs(
              currentMonthTxns
                .filter((t) => t.category === b.category && t.amount < 0)
                .reduce((s, t) => s + Number(t.amount), 0),
            );
            const pct = Math.min(100, (spent / b.limit_amount) * 100);

            let barColor = "bg-accent";
            if (pct >= 100) {
              barColor = "bg-red-500";
            } else if (pct >= 75) {
              barColor = "bg-amber-500";
            }

            return (
              <div key={b.id} className="space-y-2 group">
                <div className="flex justify-between text-xs font-medium italic group-hover:text-accent transition-colors">
                  <span>{CATEGORY_LABEL[b.category]}</span>
                  <span className="font-mono text-[11px]">
                    {fmtCurrency(spent)} / {fmtCurrency(b.limit_amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-secondary overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full ${barColor}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-8 py-24 max-w-3xl mx-auto text-center animate-reveal">
      <p className="label-eyebrow text-muted-foreground mb-3">No data yet</p>
      <h1 className="font-display text-5xl font-black tracking-tighter mb-6">
        Let's architect
        <br />
        your numbers.
      </h1>
      <p className="text-muted-foreground mb-10 max-w-md mx-auto">
        Upload a CSV from your bank or add transactions manually to see your financial health score,
        spending breakdown, and AI insights.
      </p>
      <Link
        to="/app/transactions"
        className="inline-block px-6 py-3 bg-foreground text-background text-sm font-bold tracking-wide hover:bg-accent transition-colors"
      >
        ADD YOUR FIRST TRANSACTION
      </Link>
    </div>
  );
}
// Suppress unused-import warning on CATEGORIES (kept for type narrowing reference)
void CATEGORIES;
void Cell;
