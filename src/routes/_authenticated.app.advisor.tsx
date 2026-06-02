import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/advisor")({
  head: () => ({ meta: [{ title: "AI Advisor — FinSight AI" }] }),
  component: AdvisorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Where am I overspending this month?",
  "How much should I save monthly to hit a $20k buffer?",
  "Summarize my financial health in 3 bullets.",
  "Which subscriptions look unusual?",
];

function AdvisorPage() {
  const { user } = useSupabaseSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!user || busy || !text.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast.error("Session expired. Please log in again.");
      setBusy(false);
      return;
    }

    try {
      const resp = await fetch("/api/advisor/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) { toast.error("Rate limit hit — try again in a moment."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted. Add credits in Workspace settings."); setBusy(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Advisor unavailable."); setBusy(false); return; }

      // Insert placeholder assistant message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stream error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 animate-reveal">
      <div className="mb-8">
        <p className="label-eyebrow text-muted-foreground mb-2">Advisor AI</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Ask anything about your money.</h1>
      </div>

      <div className="bg-foreground text-background border border-foreground min-h-[60vh] flex flex-col">
        <div ref={scrollRef} className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-h-[65vh]">
          {messages.length === 0 ? (
            <div className="space-y-6">
              <p className="text-sm text-background/60 leading-relaxed max-w-md">
                I have access to your last 90 days of transactions. Ask me about spending, saving, affordability, or your financial health.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs p-3 bg-white/5 border border-white/10 hover:border-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[85%] p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-accent text-background"
                    : "bg-white/10"
                }`}>
                  {m.content || <span className="opacity-50 italic">Thinking…</span>}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-white/10 p-4 flex gap-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your finances…"
            disabled={busy}
            className="flex-1 bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-background placeholder:text-background/40"
          />
          <button type="submit" disabled={busy || !input.trim()} className="px-5 py-2 bg-background text-foreground text-xs font-bold tracking-widest disabled:opacity-40">
            {busy ? "…" : "SEND"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-[10px] tracking-widest text-muted-foreground">
        INFORMATIONAL ONLY · NOT REGULATED FINANCIAL ADVICE
      </p>
    </div>
  );
}
