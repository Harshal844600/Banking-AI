export const CATEGORIES = [
  "food",
  "travel",
  "healthcare",
  "entertainment",
  "shopping",
  "education",
  "investments",
  "utilities",
  "income",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food & Dining",
  travel: "Travel",
  healthcare: "Healthcare",
  entertainment: "Entertainment",
  shopping: "Shopping",
  education: "Education",
  investments: "Investments",
  utilities: "Utilities & Bills",
  income: "Income",
  other: "Other",
};

export type Transaction = {
  id: string;
  user_id: string;
  txn_date: string;
  description: string;
  merchant: string | null;
  amount: number;
  category: Category;
  created_at: string;
};

export function fmtCurrency(n: number) {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase();
}
