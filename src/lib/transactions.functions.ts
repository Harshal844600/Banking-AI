import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORIES } from "./finance";

const RowSchema = z.object({
  txn_date: z.string().min(1).max(32),
  description: z.string().min(1).max(500),
  merchant: z.string().max(200).optional().nullable(),
  amount: z.number().finite(),
});

const ImportSchema = z.object({
  rows: z.array(RowSchema).min(1).max(500),
});

const CategoryEnum = z.enum(CATEGORIES);

/**
 * Bulk import transactions. Calls Lovable AI to categorize each row in one shot,
 * then inserts via the user-scoped supabase client (RLS).
 */
export const importTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;

    // Build categorization request
    const items = data.rows.map((r, i) => ({
      i,
      description: r.description,
      merchant: r.merchant ?? "",
      amount: r.amount,
    }));

    let categories: string[] = data.rows.map(r =>
      r.amount > 0 ? "income" : "other",
    );

    if (apiKey) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "You categorize bank transactions. Return strictly the JSON tool call. Categories: " +
                  CATEGORIES.join(", "),
              },
              {
                role: "user",
                content:
                  "Categorize each transaction. Items: " + JSON.stringify(items),
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "categorize",
                  description: "Return category for each transaction index",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            i: { type: "number" },
                            category: { type: "string", enum: [...CATEGORIES] },
                          },
                          required: ["i", "category"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "categorize" } },
          }),
        });

        if (resp.ok) {
          const json = await resp.json();
          const call = json.choices?.[0]?.message?.tool_calls?.[0];
          if (call?.function?.arguments) {
            const args = JSON.parse(call.function.arguments);
            for (const r of args.results ?? []) {
              const parsed = CategoryEnum.safeParse(r.category);
              if (parsed.success && typeof r.i === "number" && r.i < categories.length) {
                categories[r.i] = parsed.data;
              }
            }
          }
        } else {
          console.error("AI categorize failed:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("AI categorize threw:", e);
      }
    }

    const inserts = data.rows.map((r, i) => ({
      user_id: userId,
      txn_date: r.txn_date,
      description: r.description,
      merchant: r.merchant ?? null,
      amount: r.amount,
      category: categories[i] as (typeof CATEGORIES)[number],
    }));

    const { error, count } = await supabase
      .from("transactions")
      .insert(inserts, { count: "exact" });

    if (error) throw new Error(error.message);
    return { inserted: count ?? inserts.length };
  });
