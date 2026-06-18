# 🏛️ FinSight AI

> **Architectural Swiss-Design Personal Finance Dashboard Powered by TanStack Start & Supabase AI**

FinSight AI is a premium, high-contrast, minimalist personal finance manager designed around the aesthetic and structural principles of Swiss typography and architecture. It pairs real-time financial tracking, budget containment, and custom CSV statement importing with a token-authenticated, streaming AI financial advisor.

---

## 🎨 Design Philosophy: Architectural Swiss Minimalist

FinSight AI rejects the generic, cartoonish look of typical dashboards in favor of a premium, editorial aesthetic:
* **The Palette**: A strict architectural palette utilizing near-black (`#0A0A0A` or `oklch(0.145 0 0)`) ink, stark white paper backgrounds, and soft stone gray grides, punctuated with a single highly saturated cobalt blue brand accent.
* **Typography**: Heavy, geometric layouts using **Schibsted Grotesk** and **Inter** fonts. High contrast, clean outlines, and generous letter-spaced uppercase eyebrow labels.
* **Micro-Animations**: Smooth, hardware-accelerated transitions via custom utilities (`animate-reveal`, `animate-float`, `animate-pulse-soft`) and **Framer Motion** for state transitions.

---

## ✨ Key Features

### 📊 Financial Health Score (v1)
* Automatically calculates a holistic score out of 100 on the dashboard.
* Evaluates financial health based on four core pillars:
  * **Savings Rate** (40pts)
  * **Cashflow Positivity** (20pts)
  * **Spending Balance** (20pts)
  * **Account Stability** (20pts)
* Rendered on a bespoke, dynamic SVG ring with live animation and descriptive tiering.

### 💬 Streaming AI Financial Advisor
* Securely calls the `/api/advisor/stream` endpoint with token-based authentication.
* Streams responses character-by-character from the AI model.
* Automatically contextualizes discussions with the user's last 90 days of transactions.
* Includes smart suggestions to prompt questions (e.g., overspending alerts, buffer savings targets).

### 🧾 Flexible Statement Importer
* Full support for importing CSV statements directly.
* Robust parser capable of handling various CSV quirks:
  * Standard bank statement formats.
  * Headerless files.
  * Metadata-prefixed statements.
  * Split debit/credit column mappings.
* Instantly reconciles transactions into your dashboard.

### 🛡️ Budget Containment & Categorical Burn
* Custom threshold control per expense category.
* Interactive visual burn meters showing percentage utilized.
* Intelligent warning states: progress bars turn amber (75% budget) and red (100% + budget) automatically.

---

## 🛠️ Technology Stack

* **Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/start/overview) (Server-client SSR router with absolute type safety)
* **Build Engine**: [Vite](https://vitejs.dev/) with TypeScript
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with native OKLCH colors
* **Animations**: [Framer Motion](https://www.framer.com/motion/) & custom CSS keyframes
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL & Row-Level Security)
* **Charts**: [Recharts](https://recharts.org/) (High-performance responsive data visualizations)

---

## 🚀 Getting Started

### 📋 Prerequisites
* [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
* A Supabase project instance

### 🔑 Environment Variables
Create a `.env` file in the root directory. You can use the values from `.env.example` as a template:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SESSION_SECRET=your-random-session-secret-key-32-chars
```

### 📦 Installation
```bash
# Clone the repository (if not already cloned)
git clone https://github.com/Harshal844600/Banking-AI.git
cd Banking-AI

# Install dependencies
npm install
# or
bun install
```

### 💻 Local Development
Start the dev server:
```bash
npm run dev
# or
bun dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Database & SQL Schemas

The database structure is managed in the `supabase/` directory and several SQL scripts in the root:
* **`supabase_setup.sql`**: Configures the primary table structures for transactions and general configurations.
* **`supabase_budgets.sql`**: Configures budget schemas and constraints.
* **`supabase_statements.sql`**: Configures parsed bank statement logs.
* **`auto_confirm.sql`**: Utility script to automatically verify user registrations during development.

---

## 🔒 Security Best Practices

FinSight AI is built from the ground up with standard security measures:
* **CSP (Content Security Policy)**: Injected directly in the app shell (`__root.tsx`) to guard against XSS and injection attacks.
* **Lint Audits**: Runs static security verification checks through `eslint-plugin-security`.
* **Vulnerability Tracking**: Includes pre-configured scripts for routine dependency audits:
  ```bash
  npm run security:audit
  ```

---

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.
