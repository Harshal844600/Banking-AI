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
  statementId: z.string().uuid().optional().nullable(),
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
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Build categorization request
    const items = data.rows.map((r, i) => ({
      i,
      description: r.description,
      merchant: r.merchant ?? "",
      amount: r.amount,
    }));

    const categories: string[] = data.rows.map((r) => (r.amount > 0 ? "income" : "other"));

    if (geminiApiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

        const systemPrompt = "You categorize bank transactions. Return strictly a JSON object containing a 'results' array with objects having 'i' (integer index) and 'category' (string) fields. Valid categories are: " + CATEGORIES.join(", ");

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: "Categorize these transactions:\n" + JSON.stringify(items) }],
              },
            ],
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  results: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        i: { type: "INTEGER" },
                        category: {
                          type: "STRING",
                          enum: [...CATEGORIES],
                        },
                      },
                      required: ["i", "category"],
                    },
                  },
                },
                required: ["results"],
              },
            },
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const parsedData = JSON.parse(responseText);
            for (const r of parsedData.results ?? []) {
              const parsed = CategoryEnum.safeParse(r.category);
              if (parsed.success && typeof r.i === "number" && r.i < categories.length) {
                categories[r.i] = parsed.data;
              }
            }
          }
        } else {
          console.error("Gemini categorize failed:", response.status, await response.text());
        }
      } catch (e) {
        console.error("Gemini categorize threw:", e);
      }
    }

    const inserts = data.rows.map((r, i) => ({
      user_id: userId,
      txn_date: r.txn_date,
      description: r.description,
      merchant: r.merchant ?? null,
      amount: r.amount,
      category: categories[i] as (typeof CATEGORIES)[number],
      statement_id: data.statementId ?? null,
    }));

    const { error, count } = await supabase
      .from("transactions")
      .insert(inserts, { count: "exact" });

    if (error) throw new Error(error.message);
    return { inserted: count ?? inserts.length };
  });
