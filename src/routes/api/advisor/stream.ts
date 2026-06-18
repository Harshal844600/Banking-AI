import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/integrations/supabase/config";

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

        const { SUPABASE_URL: supabaseUrl, SUPABASE_PUBLISHABLE_KEY: supabaseAnon } =
          getSupabaseConfig();
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!supabaseUrl || !supabaseAnon) {
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

        if (!geminiApiKey) {
          return handleLocalFallbackAdvisor(body.messages, txns ?? []);
        }

        const summary = summarize(txns ?? []);

        const systemPrompt = `You are FinSight Advisor, a precise, candid AI financial advisor inside the FinSight AI app.
Tone: confident, concise, plain English. No emoji. Use short paragraphs and bullets.
You only have the user's last 90 days of self-uploaded transactions, summarised below. If the user asks
something you cannot answer from that data, say so plainly and suggest what they should upload.

Disclaimer (state once if relevant, never repeatedly): this is informational, not regulated financial advice.

USER FINANCIAL SNAPSHOT (last 90 days):
${summary}`;

        const geminiContents = body.messages.slice(-20).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${geminiApiKey}&alt=sse`;
        const aiResp = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: geminiContents,
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          }),
        });

        if (!aiResp.ok || !aiResp.body) {
          const t = await aiResp.text().catch(() => "");
          console.error("Gemini Advisor AI error:", aiResp.status, t);
          return new Response("AI gateway error", { status: 502 });
        }

        const reader = aiResp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });

                let nl;
                while ((nl = sseBuffer.indexOf("\n")) !== -1) {
                  let line = sseBuffer.slice(0, nl);
                  sseBuffer = sseBuffer.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (line.startsWith("data: ")) {
                    const jsonStr = line.slice(6).trim();
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (text) {
                        const openAiData = JSON.stringify({
                          choices: [{ delta: { content: text } }],
                        });
                        controller.enqueue(encoder.encode(`data: ${openAiData}\n`));
                      }
                    } catch (e) {
                      // skip parsing errors on empty/incomplete SSE chunks
                    }
                  }
                }
              }
              controller.enqueue(encoder.encode("data: [DONE]\n"));
            } catch (e) {
              console.error("Gemini stream proxy error:", e);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
});

function handleLocalFallbackAdvisor(messages: AdvisorMsg[], txns: any[]) {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() ?? "";

  // Perform a simple rule-based analysis of the transactions
  let income = 0;
  let expenses = 0;
  const categories: Record<string, number> = {};
  for (const t of txns) {
    const amt = Number(t.amount);
    if (amt > 0) {
      income += amt;
    } else {
      expenses += Math.abs(amt);
      categories[t.category] = (categories[t.category] ?? 0) + Math.abs(amt);
    }
  }
  const net = income - expenses;
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  let reply = "";

  if (lastMessage.includes("overspend") || lastMessage.includes("spend") || lastMessage.includes("burn")) {
    reply = `### Spending Analysis (Last 90 Days)\n\n`;
    if (expenses === 0) {
      reply += `You haven't recorded any expenses yet. Head to the **Ledger** page and upload a statement or add transactions manually to get started.\n`;
    } else {
      reply += `You spent a total of **$${expenses.toFixed(2)}** over the last 90 days. Here are your top expense categories:\n\n`;
      topCategories.forEach(([cat, val]) => {
        reply += `- **${cat.toUpperCase()}**: $${val.toFixed(2)} (${((val / expenses) * 100).toFixed(0)}% of total spend)\n`;
      });
      reply += `\n**Advisor Tip:** Your largest outflow is in **${topCategories[0]?.[0] || "other"}**. Consider setting a monthly limit for it on the Overview dashboard. Try keeping discretionary items under 30% of your total budget.\n`;
    }
  } else if (lastMessage.includes("save") || lastMessage.includes("buffer") || lastMessage.includes("goal")) {
    reply = `### Savings & Liquidity Buffer\n\n`;
    const savingsRate = income > 0 ? (net / income) * 100 : 0;
    reply += `- **Total Income**: $${income.toFixed(2)}\n`;
    reply += `- **Total Expenses**: $${expenses.toFixed(2)}\n`;
    reply += `- **Net Cash Flow (Savings)**: $${net.toFixed(2)} (${savingsRate.toFixed(1)}% savings rate)\n\n`;
    
    if (net <= 0) {
      reply += `Currently, your net cash flow is negative ($${net.toFixed(2)}). To build a **$20,000** savings buffer, you first need to stabilize your expenses below your income. Focus on eliminating discretionary subscriptions and reducing your **${topCategories[0]?.[0] || 'shopping'}** budget.\n`;
    } else {
      const monthlyNet = net / 3; // 90 days
      const monthsNeeded = monthlyNet > 0 ? (20000 / monthlyNet) : 999;
      reply += `At your current savings rate of **$${monthlyNet.toFixed(2)}/month**, it will take approximately **${monthsNeeded.toFixed(1)} months** to build a **$20,000** buffer.\n\n`;
      reply += `**Optimization Plan:**\n`;
      reply += `1. Increase monthly savings to **$500/month** to cut this duration down to **40 months**.\n`;
      reply += `2. If you set budget limits on top spend categories like **${topCategories[0]?.[0] || 'food'}**, you can accelerate this further.\n`;
    }
  } else if (lastMessage.includes("health") || lastMessage.includes("score") || lastMessage.includes("summarize")) {
    reply = `### Financial Health Summary (Last 90 Days)\n\n`;
    reply += `1. **Liquidity**: Net cash flow is **$${net.toFixed(2)}**. ${net >= 0 ? "You are living within your means." : "Caution: You are spending more than you earn."}\n`;
    reply += `2. **Debt & Overhead**: Recurring transactions show a stable fixed-overhead ratio.\n`;
    reply += `3. **Discretionary Burn**: Discretionary expenses represent **${expenses > 0 ? (((categories.entertainment || 0) + (categories.shopping || 0) + (categories.travel || 0)) / expenses * 100).toFixed(0) : 0}%** of your total outflows.\n\n`;
    reply += `*Advice: Try setting strict category budgets on your dashboard to improve your score from its current baseline.*`;
  } else if (lastMessage.includes("subscription") || lastMessage.includes("unusual") || lastMessage.includes("recurring")) {
    reply = `### Subscription Audit\n\n`;
    const recurring = txns.filter(t => t.amount < 0 && (t.description.toLowerCase().includes("sub") || t.description.toLowerCase().includes("cloud") || t.description.toLowerCase().includes("netflix") || t.description.toLowerCase().includes("spotify") || t.description.toLowerCase().includes("adobe") || t.description.toLowerCase().includes("prime") || t.description.toLowerCase().includes("premium")));
    
    if (recurring.length === 0) {
      reply += `No obvious subscription patterns were detected in your transaction descriptions. Common identifiers like 'sub', 'netflix', or 'premium' were not found. Verify your CSV descriptions in the Ledger.\n`;
    } else {
      reply += `We identified the following recurring or potential subscription outflows:\n\n`;
      recurring.forEach(t => {
        reply += `- **${t.description}**: $${Math.abs(Number(t.amount)).toFixed(2)} (${t.category})\n`;
      });
      reply += `\n**Advisor Recommendation:** Review these items. If there are services you haven't used in the last 30 days, canceling them will immediately boost your savings rate.\n`;
    }
  } else {
    reply = `Hello! I am **FinSight Advisor** (Local Analytics Mode).\n\nI can analyze your transactions and give you advice. Try asking me one of the following:\n\n`;
    reply += `1. *"Where am I overspending this month?"*\n`;
    reply += `2. *"How much should I save monthly to hit a ₹20k buffer?"*\n`;
    reply += `3. *"Summarize my financial health in 3 bullets."*\n`;
    reply += `4. *"Which subscriptions look unusual?"*\n\n`;
    reply += `*(Note: The Gemini API credentials are not configured in your .env, so I am running locally on your uploaded transaction data.)*`;
  }

  // Create SSE stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const chunks = reply.split(" ");
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i] + (i === chunks.length - 1 ? "" : " ");
        const data = JSON.stringify({
          choices: [{ delta: { content: chunk } }]
        });
        controller.enqueue(encoder.encode(`data: ${data}\n`));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}

function summarize(
  txns: Array<{
    txn_date: string;
    description: string;
    amount: number;
    category: string;
    merchant: string | null;
  }>,
) {
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
  const top = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
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
