import type { Transaction, Category } from "./finance";

export type HealthBreakdown = {
  total: number;
  savings: number;
  stability: number;
  balance: number;
  positivity: number;
  income: number;
  expenses: number;
};

export function computeHealthScore(txns: Transaction[]): HealthBreakdown {
  if (!txns.length) {
    return { total: 0, savings: 0, stability: 0, balance: 0, positivity: 0, income: 0, expenses: 0 };
  }
  const income = txns.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expenses = Math.abs(txns.filter(t => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0));

  // 40 pts: savings ratio
  const savingsRatio = income > 0 ? (income - expenses) / income : 0;
  const savings = Math.max(0, Math.min(40, savingsRatio * 100 * 0.8));

  // 20 pts: stability (lower stdev of weekly expense = better)
  const weekly = bucketByWeek(txns.filter(t => t.amount < 0).map(t => ({ d: t.txn_date, v: Math.abs(Number(t.amount)) })));
  const stability = 20 * (1 - clamp(cv(weekly), 0, 1));

  // 20 pts: category balance — discretionary share penalty
  const discretionary: Category[] = ["entertainment", "shopping", "travel"];
  const discSum = txns
    .filter(t => t.amount < 0 && discretionary.includes(t.category))
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const discShare = expenses > 0 ? discSum / expenses : 0;
  const balance = 20 * (1 - clamp(discShare * 1.5, 0, 1));

  // 20 pts: positive months ratio
  const months = bucketByMonth(txns);
  const positiveMonths = Object.values(months).filter(net => net >= 0).length;
  const positivity = Object.keys(months).length
    ? 20 * (positiveMonths / Object.keys(months).length)
    : 0;

  const total = Math.round(savings + stability + balance + positivity);
  return {
    total: Math.max(0, Math.min(100, total)),
    savings: Math.round(savings),
    stability: Math.round(stability),
    balance: Math.round(balance),
    positivity: Math.round(positivity),
    income,
    expenses,
  };
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Healthy";
  if (score >= 45) return "Fair";
  if (score >= 25) return "At risk";
  return "Critical";
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function cv(values: number[]) {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  if (m === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance) / m;
}

function bucketByWeek(items: { d: string; v: number }[]) {
  const buckets: Record<string, number> = {};
  for (const it of items) {
    const d = new Date(it.d);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${week}`;
    buckets[key] = (buckets[key] ?? 0) + it.v;
  }
  return Object.values(buckets);
}

export function bucketByMonth(txns: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    const d = new Date(t.txn_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out[key] = (out[key] ?? 0) + Number(t.amount);
  }
  return out;
}

export function spendByCategory(txns: Transaction[]) {
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (Number(t.amount) >= 0) continue;
    out[t.category] = (out[t.category] ?? 0) + Math.abs(Number(t.amount));
  }
  return Object.entries(out)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlyCashflow(txns: Transaction[]) {
  const inc: Record<string, number> = {};
  const exp: Record<string, number> = {};
  for (const t of txns) {
    const d = new Date(t.txn_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (Number(t.amount) >= 0) inc[key] = (inc[key] ?? 0) + Number(t.amount);
    else exp[key] = (exp[key] ?? 0) + Math.abs(Number(t.amount));
  }
  const keys = Array.from(new Set([...Object.keys(inc), ...Object.keys(exp)])).sort();
  return keys.slice(-6).map(k => ({
    month: new Date(k + "-01").toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    income: Math.round(inc[k] ?? 0),
    expense: Math.round(exp[k] ?? 0),
    net: Math.round((inc[k] ?? 0) - (exp[k] ?? 0)),
  }));
}
