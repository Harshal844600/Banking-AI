## FinSight AI — V1 Build Plan

**Stack reality check:** Building on this project's actual stack (TanStack Start + Lovable Cloud + Lovable AI Gateway), not MERN + Python. Same features, edge-runtime friendly.

## V1 scope (confirmed)
- Customer-only experience (Bank Officer / Admin roles deferred to phase 2)
- Auth (email/password + Google)
- Manual transaction entry **and** CSV upload
- Financial Health Score
- Spending analysis (categories, monthly cash flow, recent ledger)
- AI Financial Advisor chat (Lovable AI Gateway, streaming)
- Auto-categorization via AI on import

## Design
Architectural Swiss direction: white + zinc-100 surfaces, black ink, blue accent (#2563EB), Schibsted Grotesk display + Inter body, hairline borders, italic micro-copy, uppercase tracking-widest labels, square corners. Tokens copied verbatim into `src/styles.css`.

## Pages

```text
/                  Landing (hero + dashboard preview + CTA → /signup)
/login             Email/password + Google
/signup            Email/password + Google
/app               Dashboard (Health Score, Cash Flow, Categorical Burn, Recent Ledger, AI Advisor side panel)
/app/transactions  Full ledger + manual add + CSV upload
/app/advisor       Full-page AI advisor chat
```

`_authenticated` layout guards `/app/*` routes.

## Data model (Lovable Cloud / Postgres)

```text
profiles           id (=auth.users.id), display_name, created_at
transactions       id, user_id, txn_date, description, amount (negative = expense),
                   category, merchant, created_at
categories enum:   food, travel, healthcare, entertainment, shopping,
                   education, investments, utilities, income, other
```

RLS: each user reads/writes only their own rows. No roles table needed in v1.

## Core logic

**CSV import** — TanStack server function. Accepts standard bank CSV (date, description, amount). Server fn passes parsed rows to Lovable AI (gemini-3-flash) for batch categorization, inserts via service role.

**Financial Health Score (0–100)** — computed client-side from last 90 days:
- Savings ratio (40 pts): (income − expenses) / income
- Expense stability (20 pts): inverse of stdev across weeks
- Category balance (20 pts): discretionary share penalty
- Cash flow positivity (20 pts): positive months / total

**AI Advisor** — TanStack server route `/api/advisor/stream` (SSE). System prompt loaded with the user's last 90 days of transaction summary (totals by category, monthly net). Streams Lovable AI responses token-by-token.

## Charts
Recharts: radial Health Score, horizontal bars for category burn, bar chart for monthly cash flow.

## Out of scope for v1 (call out so expectations are aligned)
Fraud Detection, Loan Approval, Customer Segmentation, Credit Risk, Predictive Forecasting, PDF/Excel report export, Bank Officer dashboard, Admin dashboard, Voice assistant, 3D visuals, RAG knowledge base, Explainable AI (SHAP/LIME), Gamification badges, MFA. These become phase 2 after v1 lands.

## Technical notes
- Lovable Cloud will be enabled (provides Postgres + auth + secrets)
- `LOVABLE_API_KEY` auto-provisioned for AI Gateway
- All AI calls go through server functions / server routes — never from the client
- CSV parsing with `papaparse`
- Charts with `recharts` (already in shadcn `chart.tsx`)

## Build order
1. Enable Lovable Cloud, write design tokens into `src/styles.css`
2. DB migration: `transactions` table + RLS + grants
3. Landing page (port from selected prototype)
4. Auth pages + `_authenticated` layout
5. Transactions page: manual entry + CSV upload + AI categorization server fn
6. Dashboard: Health Score + charts + recent ledger
7. AI Advisor streaming chat (server route + client UI)
8. Polish + verify with browser tools

After approval I'll implement straight through.