import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinSight AI — Your wealth, architected" },
      { name: "description", content: "Premium AI-powered banking analytics. Upload your CSV, get a financial health score, smart category insights, and a private AI advisor." },
      { property: "og:title", content: "FinSight AI — Your wealth, architected" },
      { property: "og:description", content: "Premium AI-powered banking analytics for the modern individual." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-foreground flex items-center justify-center text-background font-display font-black text-xl italic">F</div>
          <span className="font-display font-bold tracking-tight text-xl">FinSight AI</span>
        </Link>
        <div className="hidden md:flex gap-8 text-sm font-medium tracking-tight">
          <a href="#features" className="hover:text-accent transition-colors">Capabilities</a>
          <a href="#how" className="hover:text-accent transition-colors">How it works</a>
          <a href="#security" className="hover:text-accent transition-colors">Security</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold hover:text-accent transition-colors">Log in</Link>
          <Link to="/signup" className="px-5 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-accent transition-colors">
            Request access
          </Link>
        </div>
      </nav>

      <section className="px-8 pt-20 pb-12 max-w-7xl mx-auto animate-reveal">
        <div className="grid md:grid-cols-2 gap-16 items-end">
          <div>
            <p className="label-eyebrow text-accent mb-6">Intelligence is the new capital</p>
            <h1 className="font-display text-6xl md:text-7xl font-black leading-[0.9] tracking-tighter mb-8">
              YOUR WEALTH,<br />ARCHITECTED.
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed mb-10">
              Advanced liquidity monitoring, intelligent expense categorisation, and a private AI advisor — all powered by your own transaction data.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/signup" className="px-6 py-3 bg-foreground text-background text-sm font-bold tracking-wide hover:bg-accent transition-colors">
                GET STARTED
              </Link>
              <Link to="/login" className="px-6 py-3 border border-foreground/15 text-sm font-bold tracking-wide hover:bg-secondary transition-colors">
                LOG IN
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="p-6 border-l-4 border-accent bg-secondary">
              <p className="label-eyebrow mb-3">Upload statement</p>
              <div className="border-2 border-dashed border-foreground/10 px-4 py-10 flex flex-col items-center justify-center gap-3">
                <span className="text-xs text-muted-foreground font-medium tracking-widest">DRAG CSV — OR —</span>
                <Link to="/signup" className="px-3 py-1 bg-foreground text-background text-[10px] font-bold tracking-wider">
                  CREATE ACCOUNT
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-8 pb-20 max-w-7xl mx-auto">
        <div className="bg-secondary border border-border p-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-display text-4xl font-bold tracking-tight">Portfolio Pulse</h2>
              <p className="text-muted-foreground text-sm">Real-time intelligence dashboard preview</p>
            </div>
            <div className="flex gap-2 text-xs font-bold">
              <span className="px-3 py-1 bg-background border border-border">D</span>
              <span className="px-3 py-1 bg-background border border-border text-muted-foreground">W</span>
              <span className="px-3 py-1 bg-foreground text-background">M</span>
              <span className="px-3 py-1 bg-background border border-border text-muted-foreground">Y</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-background p-8 border border-border flex flex-col items-center justify-center relative">
              <div className="absolute top-4 left-4 label-eyebrow text-foreground/20 italic">Health Metric v1</div>
              <div className="size-48 rounded-full border-[12px] border-secondary flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-[12px] border-accent border-t-transparent border-r-transparent -rotate-45" />
                <span className="font-display text-6xl font-black">84</span>
                <span className="label-eyebrow text-muted-foreground">Excellent</span>
              </div>
              <p className="mt-6 text-xs text-center text-muted-foreground leading-relaxed">
                Capital efficiency is 12% higher than last quarter — driven by reduced recurring overhead.
              </p>
            </div>

            <div className="col-span-12 lg:col-span-8 bg-background p-8 border border-border">
              <div className="flex justify-between items-start mb-8">
                <h3 className="label-eyebrow">Categorical Burn</h3>
                <span className="text-xs font-medium text-accent">+4.2% VS AVG</span>
              </div>
              <div className="space-y-6">
                {[
                  { name: "Fixed Operations", value: "$12,400.00", pct: 65, bar: "bg-foreground" },
                  { name: "Discretionary Lifestyle", value: "$4,120.00", pct: 22, bar: "bg-accent" },
                  { name: "Investment Vehicles", value: "$8,900.00", pct: 45, bar: "bg-foreground" },
                ].map(r => (
                  <div key={r.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-medium italic">
                      <span>{r.name}</span>
                      <span>{r.value}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary">
                      <div className={`h-full ${r.bar}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-7 bg-background border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-foreground text-background flex justify-between items-center">
                <span className="label-eyebrow">Recent Ledger</span>
                <span className="text-[10px] opacity-50">SYNCED 2M AGO</span>
              </div>
              <table className="w-full text-left">
                <tbody className="divide-y divide-border">
                  {[
                    { d: "SEP 14", n: "Cloud Systems Inc.", c: "Infrastructure", a: "-$2,450.00", pos: false },
                    { d: "SEP 12", n: "Nordic Aviation", c: "Travel", a: "-$1,102.50", pos: false },
                    { d: "SEP 10", n: "Dividend Credit", c: "Portfolio Income", a: "+$14,200.00", pos: true },
                  ].map(r => (
                    <tr key={r.d}>
                      <td className="py-4 px-6 text-xs font-bold">{r.d}</td>
                      <td className="py-4 px-6">
                        <div className="text-xs font-medium">{r.n}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.c}</div>
                      </td>
                      <td className={`py-4 px-6 text-right text-xs font-bold ${r.pos ? "text-accent" : ""}`}>{r.a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              <div className="bg-foreground text-background p-8 flex-1">
                <h3 className="font-display text-2xl font-bold mb-4 tracking-tight">Advisor AI</h3>
                <div className="space-y-4 mb-8">
                  <div className="bg-white/10 p-3 text-xs leading-relaxed">
                    Your tax liability for Q4 is projected at <span className="text-accent font-bold">$18,400</span>. Would you like me to optimize your remaining deduction window?
                  </div>
                  <div className="text-xs opacity-50 italic">Awaiting user input…</div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/40">Ask about your finances…</div>
                  <div className="px-4 py-2 bg-background text-foreground text-xs font-bold">SEND</div>
                </div>
              </div>
              <Link to="/signup" className="bg-accent text-background p-4 flex items-center justify-between hover:opacity-90 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="size-8 border border-white/20 flex items-center justify-center font-bold text-xs">+</div>
                  <span className="label-eyebrow">Batch Import CSV</span>
                </div>
                <span className="text-[10px] opacity-70">PROCESSED IN SECONDS</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="px-8 py-20 max-w-7xl mx-auto border-t border-border">
        <div className="grid md:grid-cols-3 gap-12">
          {[
            { n: "01", t: "Upload", d: "Drop a CSV from any bank or add transactions manually. We support standard date/description/amount columns." },
            { n: "02", t: "Categorize", d: "Our AI categorizes every transaction across 10 spending classes — food, travel, utilities, investments and more." },
            { n: "03", t: "Decide", d: "Watch your financial health score react in real-time. Ask the AI advisor anything about your spending or savings." },
          ].map(s => (
            <div key={s.n} className="border-t-2 border-foreground pt-6">
              <div className="label-eyebrow text-muted-foreground mb-3">{s.n}</div>
              <h3 className="font-display text-2xl font-bold tracking-tight mb-3">{s.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="security" className="px-8 py-12 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
          <span>FINSIGHT ANALYTICS ENGINE // V.26.1</span>
          <span>NO FINANCIAL ADVICE INTENDED</span>
          <span>ENCRYPTED END-TO-END</span>
        </div>
      </footer>
    </div>
  );
}
