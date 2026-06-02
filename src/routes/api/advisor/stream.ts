import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type AdvisorMsg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/advisor/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !supabaseAnon || !lovableKey) {
          return new Response("Server not configured", { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { messages: AdvisorMsg[] };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("Bad request", { status: 400 });
        }

        // Pull last 90 days of transactions for context
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const { data: txns } = await supabase
          .from("transactions")
          .select("txn_date, description, amount, category, merchant")
          .gte("txn_date", since.toISOString().slice(0, 10))
          .order("txn_date", { ascending: false })
          .limit(500);

        const summary = summarize(txns ?? []);

        const systemPrompt = `You are FinSight Advisor, a precise, candid AI financial advisor inside the FinSight AI app.
Tone: confident, concise, plain English. No emoji. Use short paragraphs and bullets.
You only have the user's last 90 days of self-uploaded transactions, summarised below. If the user asks
something you cannot answer from that data, say so plainly and suggest what they should upload.

Disclaimer (state once if relevant, never repeatedly): this is informational, not regulated financial advice.

USER FINANCIAL SNAPSHOT (last 90 days):
${summary}`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...body.messages.slice(-20),
            ],
          }),
        });

        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace settings." }), {
            status: 402,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!aiResp.ok || !aiResp.body) {
          const t = await aiResp.text().catch(() => "");
          console.error("Advisor AI error:", aiResp.status, t);
          return new Response("AI gateway error", { status: 502 });
        }

        return new Response(aiResp.body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});

function summarize(txns: Array<{ txn_date: string; description: string; amount: number; category: string; merchant: string | null }>) {
  if (!txns.length) return "No transactions uploaded yet.";
  const byCat: Record<string, number> = {};
  let income = 0;
  let expense = 0;
  const monthly: Record<string, { i: number; e: number }> = {};
  for (const t of txns) {
    const amt = Number(t.amount);
    if (amt >= 0) income += amt;
    else {
      expense += Math.abs(amt);
      byCat[t.category] = (byCat[t.category] ?? 0) + Math.abs(amt);
    }
    const m = t.txn_date.slice(0, 7);
    monthly[m] ??= { i: 0, e: 0 };
    if (amt >= 0) monthly[m].i += amt;
    else monthly[m].e += Math.abs(amt);
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const months = Object.entries(monthly).sort();
  return [
    `Transactions: ${txns.length}`,
    `Total income: $${income.toFixed(2)}`,
    `Total expenses: $${expense.toFixed(2)}`,
    `Net: $${(income - expense).toFixed(2)}`,
    `Top spend categories: ${top.map(([c, v]) => `${c} $${v.toFixed(0)}`).join(", ")}`,
    `By month: ${months.map(([m, v]) => `${m} in $${v.i.toFixed(0)} / out $${v.e.toFixed(0)}`).join(" | ")}`,
  ].join("\n");
}
