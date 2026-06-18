import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/use-auth";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  fmtCurrency,
  fmtDateShort,
  type Category,
  type Transaction,
} from "@/lib/finance";
import { importTransactions } from "@/lib/transactions.functions";

export const Route = createFileRoute("/_authenticated/app/transactions")({
  head: () => ({ meta: [{ title: "Ledger — FinSight AI" }] }),
  component: TxnsPage,
});

function TxnsPage() {
  const { user } = useSupabaseSession();
  const qc = useQueryClient();
  const importFn = useServerFn(importTransactions);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("txn_date", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => ({ ...d, amount: Number(d.amount) })) as Transaction[];
    },
  });

  const { data: statements = [] } = useQuery({
    queryKey: ["statements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("statements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Manual entry form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["transactions"] });

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      toast.error("Enter a non-zero amount (negative for expenses)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      txn_date: date,
      description: desc,
      merchant: merchant || null,
      amount: amt,
      category,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transaction added");
    setDesc("");
    setMerchant("");
    setAmount("");
    refresh();
  };

  const onCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setBusy(true);
    
    Papa.parse(file, {
      header: false,
      skipEmptyLines: "greedy",
      complete: async (res) => {
        const rawRows = res.data as string[][];
        if (!rawRows || rawRows.length === 0) {
          toast.error("CSV is empty");
          setBusy(false);
          return;
        }

        // Find header row and column mapping
        let bestHeaderIdx = -1;
        let bestScore = 0;
        let mapping: ColumnMapping = {
          dateIdx: -1,
          descIdx: -1,
          amountIdx: -1,
          debitIdx: -1,
          creditIdx: -1,
          merchantIdx: -1,
          typeIdx: -1
        };

        const scanLimit = Math.min(rawRows.length, 20);
        for (let i = 0; i < scanLimit; i++) {
          const row = rawRows[i];
          const { score, mapping: rowMapping } = scoreRowForHeaders(row);
          if (score > bestScore) {
            bestScore = score;
            bestHeaderIdx = i;
            mapping = {
              dateIdx: rowMapping.dateIdx ?? -1,
              descIdx: rowMapping.descIdx ?? -1,
              amountIdx: rowMapping.amountIdx ?? -1,
              debitIdx: rowMapping.debitIdx ?? -1,
              creditIdx: rowMapping.creditIdx ?? -1,
              merchantIdx: rowMapping.merchantIdx ?? -1,
              typeIdx: rowMapping.typeIdx ?? -1
            };
          }
        }

        // If we found both debit and credit indices, and they are distinct, disable amountIdx
        if (mapping.debitIdx !== -1 && mapping.creditIdx !== -1 && mapping.debitIdx !== mapping.creditIdx) {
          mapping.amountIdx = -1;
        }
        if (mapping.debitIdx === mapping.creditIdx) {
          mapping.debitIdx = -1;
          mapping.creditIdx = -1;
        }

        let dataRows: string[][] = [];
        if (bestHeaderIdx !== -1) {
          dataRows = rawRows.slice(bestHeaderIdx + 1);
        } else {
          mapping = autoDetectColumns(rawRows);
          dataRows = rawRows;
        }

        if (mapping.dateIdx === -1 || (mapping.amountIdx === -1 && mapping.debitIdx === -1 && mapping.creditIdx === -1)) {
          toast.error("Could not auto-detect columns. Verify Date and Amount/Debit/Credit columns exist.");
          setBusy(false);
          return;
        }

        // Gather all raw date values for date format detection
        const dateStrings: string[] = [];
        for (const row of dataRows) {
          if (row[mapping.dateIdx]) {
            dateStrings.push(row[mapping.dateIdx]);
          }
        }

        const detectedFormat = detectDateFormat(dateStrings);

        const rows: Array<{
          txn_date: string;
          description: string;
          merchant: string | null;
          amount: number;
        }> = [];

        for (const row of dataRows) {
          if (row.length === 0 || row.every(cell => !cell.trim())) continue;

          const dateRaw = row[mapping.dateIdx];
          if (!dateRaw) continue;

          const parsedDate = parseNormalizedDate(dateRaw, detectedFormat);
          if (!parsedDate) continue;

          let descRaw = "";
          if (mapping.descIdx !== -1 && row[mapping.descIdx]) {
            descRaw = row[mapping.descIdx].trim();
          }

          let merRaw: string | null = null;
          if (mapping.merchantIdx !== -1 && row[mapping.merchantIdx]) {
            merRaw = row[mapping.merchantIdx].trim();
          }

          let amt: number | null = null;

          if (mapping.amountIdx !== -1 && row[mapping.amountIdx]) {
            amt = parseCleanAmount(row[mapping.amountIdx]);
            if (amt !== null && mapping.typeIdx !== -1 && row[mapping.typeIdx]) {
              const typeRaw = row[mapping.typeIdx].toLowerCase().trim();
              if (typeRaw.startsWith("dr") || typeRaw.startsWith("deb") || typeRaw.startsWith("soll") || typeRaw.startsWith("db") || typeRaw === "withdrawal" || typeRaw === "expense") {
                amt = -Math.abs(amt);
              } else if (typeRaw.startsWith("cr") || typeRaw.startsWith("cred") || typeRaw.startsWith("haben") || typeRaw === "deposit" || typeRaw === "income") {
                amt = Math.abs(amt);
              }
            }
          } else {
            const deb = mapping.debitIdx !== -1 && row[mapping.debitIdx] ? parseCleanAmount(row[mapping.debitIdx]) : null;
            const cred = mapping.creditIdx !== -1 && row[mapping.creditIdx] ? parseCleanAmount(row[mapping.creditIdx]) : null;

            if (deb !== null && deb !== 0) {
              amt = -Math.abs(deb);
            } else if (cred !== null && cred !== 0) {
              amt = Math.abs(cred);
            }
          }

          if (amt === null || !Number.isFinite(amt) || amt === 0) continue;

          rows.push({
            txn_date: parsedDate,
            description: descRaw || "CSV Transaction",
            merchant: merRaw || null,
            amount: amt
          });
        }
        
        if (rows.length === 0) {
          toast.error("No valid transaction rows found. Verify headers/columns for Date, Description, and Amount.");
          setBusy(false);
          return;
        }
        if (rows.length > 500) {
          toast.error("Maximum 500 rows per import");
          setBusy(false);
          return;
        }
        
        try {
          // 1. Upload CSV to Supabase Storage
          const filePath = `${user.id}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("statements")
            .upload(filePath, file);
            
          if (uploadError) throw uploadError;
          
          // 2. Insert metadata into public.statements table
          const { data: stmtData, error: dbError } = await supabase
            .from("statements")
            .insert({
              user_id: user.id,
              filename: file.name,
              file_path: filePath,
              row_count: rows.length
            })
            .select()
            .single();
            
          if (dbError) throw dbError;
          
          // 3. Call serverFn import with statementId
          const result = await importFn({
            data: {
              rows,
              statementId: stmtData.id
            }
          });
          
          toast.success(`Imported ${result.inserted} transactions and categorized via Gemini AI`);
          refresh();
          qc.invalidateQueries({ queryKey: ["statements"] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed");
        } finally {
          setBusy(false);
          if (fileRef.current) fileRef.current.value = "";
        }
      },
      error: (err) => {
        toast.error(err.message);
        setBusy(false);
      },
    });
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const onDeleteStatement = async (id: string, filePath: string) => {
    if (!window.confirm("Are you sure you want to delete this statement? This will delete all transactions imported from it!")) return;
    setBusy(true);
    try {
      // 1. Delete physical file from storage
      await supabase.storage.from("statements").remove([filePath]);
      
      // 2. Delete database record (cascading will delete linked transactions)
      const { error: dbError } = await supabase
        .from("statements")
        .delete()
        .eq("id", id);
        
      if (dbError) throw dbError;
      
      toast.success("Statement and associated transactions deleted");
      refresh();
      qc.invalidateQueries({ queryKey: ["statements"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete statement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 md:px-8 py-8 max-w-7xl mx-auto animate-reveal">
      <div className="mb-8">
        <p className="label-eyebrow text-muted-foreground mb-2">Ledger</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Transactions</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Manual entry */}
        <form
          onSubmit={onAdd}
          className="lg:col-span-2 bg-background border border-border p-6 space-y-4"
        >
          <h2 className="label-eyebrow">Manual entry</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Amount (negative = expense)">
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="-42.50"
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <input
                type="text"
                required
                maxLength={200}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Merchant (optional)">
              <input
                type="text"
                maxLength={120}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 bg-foreground text-background text-xs font-bold tracking-widest hover:bg-accent transition-colors disabled:opacity-50"
          >
            {busy ? "…" : "ADD TRANSACTION"}
          </button>
        </form>

        {/* Right side: CSV upload & uploaded statements */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* CSV upload */}
          <div className="bg-secondary border-l-4 border-accent p-6 flex flex-col h-full min-h-[300px]">
            <h2 className="label-eyebrow mb-3">Import CSV</h2>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Columns: date, description, amount (and optional merchant). AI will auto-categorize on
              import.
            </p>
            <label className="border-2 border-dashed border-foreground/15 px-4 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent transition-colors">
              <span className="text-xs text-muted-foreground font-medium tracking-widest">
                DROP CSV HERE
              </span>
              <span className="px-3 py-1 bg-foreground text-background text-[10px] font-bold tracking-wider">
                BROWSE FILES
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onCsv}
                disabled={busy}
              />
            </label>
            <p className="mt-auto pt-6 text-[10px] tracking-widest text-muted-foreground">
              PROCESSED IN SECONDS · 500 ROWS MAX
            </p>
          </div>

          {/* Uploaded statements history */}
          <div className="bg-background border border-border p-6">
            <h3 className="label-eyebrow mb-4">Uploaded Statements</h3>
            {statements.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No uploaded statements yet.</p>
            ) : (
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                {statements.map((s) => (
                  <div key={s.id} className="text-xs border-b border-border/50 pb-3 last:border-0 last:pb-0 flex items-start justify-between gap-3 group">
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-foreground group-hover:text-accent transition-colors" title={s.filename}>
                        {s.filename}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {fmtDateShort(s.created_at)} · {s.row_count} rows
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteStatement(s.id, s.file_path)}
                      disabled={busy}
                      className="text-[10px] text-muted-foreground hover:text-destructive font-bold tracking-widest uppercase transition-colors shrink-0 disabled:opacity-50"
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-background border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-foreground text-background flex justify-between items-center">
          <span className="label-eyebrow">Ledger · {txns.length} entries</span>
          <span className="text-[10px] opacity-50">SORTED NEWEST FIRST</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No transactions yet. Add one above or upload a CSV.
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-secondary sticky top-0">
                <tr className="text-[10px] font-bold tracking-widest text-muted-foreground">
                  <th className="py-2 px-5">DATE</th>
                  <th className="py-2 px-2">DESCRIPTION</th>
                  <th className="py-2 px-2">CATEGORY</th>
                  <th className="py-2 px-5 text-right">AMOUNT</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txns.map((t) => (
                  <tr key={t.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-5 text-[10px] font-bold tracking-wider text-muted-foreground">
                      {fmtDateShort(t.txn_date)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-xs font-medium">{t.description}</div>
                      {t.merchant && (
                        <div className="text-[10px] text-muted-foreground">{t.merchant}</div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[10px] uppercase tracking-wider">
                      {CATEGORY_LABEL[t.category]}
                    </td>
                    <td
                      className={`py-3 px-5 text-right text-xs font-bold ${t.amount > 0 ? "text-accent" : ""}`}
                    >
                      {fmtCurrency(t.amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onDelete(t.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        DEL
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-foreground/15 bg-background text-sm focus:outline-none focus:border-accent transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-eyebrow block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

interface ColumnMapping {
  dateIdx: number;
  descIdx: number;
  amountIdx: number;
  debitIdx: number;
  creditIdx: number;
  merchantIdx: number;
  typeIdx: number;
}

const DATE_KEYWORDS = [
  "date", "txn", "timestamp", "posted", "booking", "effective", "valuta",
  "datum", "buchungsdatum", "valutadatum", "buchung",
  "fecha", "data", "date transaction", "date de valeur", "date d'opération"
];

const DESC_KEYWORDS = [
  "desc", "memo", "narrative", "details", "text", "remarks", "comment", "info", "transaction", "particulars",
  "verwendungszweck", "empfänger", "purpose", "info", "details", "concept", "concepto",
  "libellé", "libelle", "motif", "causale", "descripción", "descrição"
];

const AMT_KEYWORDS = [
  "amount", "value", "sum", "total", "charge", "balance", "gross", "net",
  "betrag", "umsatz", "wert", "saldo", "betrag (eur)", "betrag (usd)",
  "montant", "monto", "importe", "importo", "valor"
];

const DEBIT_KEYWORDS = [
  "debit", "withdrawal", "out", "expense", "charge", "paid out",
  "soll", "ausgabe", "belastung", "abgang",
  "débit", "debit", "debito", "débito", "gasto", "salida"
];

const CREDIT_KEYWORDS = [
  "credit", "deposit", "in", "income", "payment", "paid in",
  "haben", "einnahme", "gutschrift", "zugang",
  "crédit", "credit", "credito", "crédito", "ingreso", "entrada"
];

const MERCH_KEYWORDS = [
  "merchant", "payee", "recipient", "sender", "beneficiary", "payto", "partner", "creditor", "debtor",
  "zahlungssempfänger", "empfänger", "beneficiario", "destinatario"
];

const TYPE_KEYWORDS = [
  "type", "direction", "dr/cr", "dc", "s/h", "transaction type", "category", "class",
  "art", "typ", "tipo", "mouvement"
];

function scoreRowForHeaders(row: string[]): { score: number; mapping: Partial<ColumnMapping> } {
  let bestDateIdx = -1;
  let bestDescIdx = -1;
  let bestAmtIdx = -1;
  let bestDebitIdx = -1;
  let bestCreditIdx = -1;
  let bestMerchIdx = -1;
  let bestTypeIdx = -1;

  let dateScore = 0;
  let descScore = 0;
  let amtScore = 0;
  let debitScore = 0;
  let creditScore = 0;
  let merchScore = 0;
  let typeScore = 0;

  for (let i = 0; i < row.length; i++) {
    const text = row[i].trim().toLowerCase();
    if (!text) continue;

    // Date check
    for (const kw of DATE_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > dateScore) {
        dateScore = score;
        bestDateIdx = i;
      }
    }
    // Desc check
    for (const kw of DESC_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > descScore) {
        descScore = score;
        bestDescIdx = i;
      }
    }
    // Amount check
    for (const kw of AMT_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > amtScore) {
        amtScore = score;
        bestAmtIdx = i;
      }
    }
    // Debit check
    for (const kw of DEBIT_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > debitScore) {
        debitScore = score;
        bestDebitIdx = i;
      }
    }
    // Credit check
    for (const kw of CREDIT_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > creditScore) {
        creditScore = score;
        bestCreditIdx = i;
      }
    }
    // Merchant check
    for (const kw of MERCH_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > merchScore) {
        merchScore = score;
        bestMerchIdx = i;
      }
    }
    // Type check
    for (const kw of TYPE_KEYWORDS) {
      const score = text === kw ? 10 : text.includes(kw) ? 5 : 0;
      if (score > typeScore) {
        typeScore = score;
        bestTypeIdx = i;
      }
    }
  }

  // We require at least Date and one other primary column to consider this a valid header row
  const isValidHeader = dateScore > 0 && (descScore > 0 || amtScore > 0 || debitScore > 0 || creditScore > 0);

  const totalScore = dateScore + descScore + amtScore + debitScore + creditScore + merchScore + typeScore;

  const mapping: Partial<ColumnMapping> = {};
  if (bestDateIdx !== -1) mapping.dateIdx = bestDateIdx;
  if (bestDescIdx !== -1) mapping.descIdx = bestDescIdx;
  if (bestAmtIdx !== -1) mapping.amountIdx = bestAmtIdx;
  if (bestDebitIdx !== -1) mapping.debitIdx = bestDebitIdx;
  if (bestCreditIdx !== -1) mapping.creditIdx = bestCreditIdx;
  if (bestMerchIdx !== -1) mapping.merchantIdx = bestMerchIdx;
  if (bestTypeIdx !== -1) mapping.typeIdx = bestTypeIdx;

  return {
    score: isValidHeader ? totalScore : 0,
    mapping,
  };
}

function autoDetectColumns(rows: string[][]): ColumnMapping {
  const maxCols = Math.max(...rows.map(r => r.length));
  
  const dateCounts = new Array(maxCols).fill(0);
  const numCounts = new Array(maxCols).fill(0);
  const textCounts = new Array(maxCols).fill(0);
  
  // Find up to 10 non-empty rows for profiling
  const sampleRows: string[][] = [];
  for (const r of rows) {
    if (r.length > 0 && !r.every(c => !c.trim())) {
      sampleRows.push(r);
      if (sampleRows.length >= 10) break;
    }
  }
  
  const validRowsCount = sampleRows.length;
  
  for (const row of sampleRows) {
    for (let c = 0; c < row.length; c++) {
      const val = row[c].trim();
      if (!val) continue;
      
      // Check date (use DMY or MDY fallback check)
      if (parseNormalizedDate(val, 'DMY') !== null || parseNormalizedDate(val, 'MDY') !== null) {
        dateCounts[c]++;
      }
      
      // Check number
      const parsedNum = parseCleanAmount(val);
      if (parsedNum !== null && !isYearLike(val)) {
        numCounts[c]++;
      }
      
      // Check text (non-date, non-number)
      if (val.length > 2 && parseNormalizedDate(val, 'DMY') === null && parseNormalizedDate(val, 'MDY') === null && parsedNum === null) {
        textCounts[c]++;
      }
    }
  }
  
  function isYearLike(val: string): boolean {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1980 && num <= 2100 && val.length === 4;
  }
  
  let dateIdx = -1;
  let maxDateCount = 0;
  for (let c = 0; c < maxCols; c++) {
    if (dateCounts[c] > maxDateCount && dateCounts[c] >= Math.min(2, validRowsCount)) {
      maxDateCount = dateCounts[c];
      dateIdx = c;
    }
  }
  
  // Find numeric columns
  const numericIndices: number[] = [];
  for (let c = 0; c < maxCols; c++) {
    if (c === dateIdx) continue;
    if (numCounts[c] >= Math.min(2, validRowsCount)) {
      numericIndices.push(c);
    }
  }
  
  let amountIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;
  
  if (numericIndices.length === 1) {
    amountIdx = numericIndices[0];
  } else if (numericIndices.length >= 2) {
    debitIdx = numericIndices[0];
    creditIdx = numericIndices[1];
  }
  
  // Find text columns
  const textIndices: number[] = [];
  for (let c = 0; c < maxCols; c++) {
    if (c === dateIdx || c === amountIdx || c === debitIdx || c === creditIdx) continue;
    if (textCounts[c] >= Math.min(1, validRowsCount)) {
      textIndices.push(c);
    }
  }
  
  let descIdx = -1;
  let merchantIdx = -1;
  if (textIndices.length > 0) {
    descIdx = textIndices[0];
  }
  if (textIndices.length > 1) {
    merchantIdx = textIndices[1];
  }
  
  return {
    dateIdx,
    descIdx,
    amountIdx,
    debitIdx,
    creditIdx,
    merchantIdx,
    typeIdx: -1
  };
}

function detectDateFormat(dateStrings: string[]): 'DMY' | 'MDY' | 'YMD' {
  let hasFirstPartDay = false;
  let hasSecondPartDay = false;
  let hasFirstPartYear = false;
  
  for (const s of dateStrings) {
    if (!s) continue;
    const parts = s.trim().split(/[-/.]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      
      if (parts[0].length === 4) {
        hasFirstPartYear = true;
      } else if (p0 > 12 && p0 <= 31) {
        hasFirstPartDay = true;
      } else if (p1 > 12 && p1 <= 31) {
        hasSecondPartDay = true;
      }
    }
  }
  
  if (hasFirstPartYear) return 'YMD';
  if (hasFirstPartDay) return 'DMY';
  if (hasSecondPartDay) return 'MDY';
  
  // Fallback check for dots
  for (const s of dateStrings) {
    if (s && s.includes('.')) {
      return 'DMY';
    }
  }
  
  return 'MDY';
}

function parseNormalizedDate(s: string, format: 'DMY' | 'MDY' | 'YMD'): string | null {
  if (!s) return null;
  const cleaned = s.trim();
  
  const iso = cleaned.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  
  const parts = cleaned.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0]);
    const p1 = parseInt(parts[1]);
    const p2 = parseInt(parts[2]);
    if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return null;
    
    let y = parts[2];
    if (y.length === 2) {
      y = "20" + y;
    }
    
    if (format === 'YMD') {
      const year = parts[0].length === 4 ? parts[0] : y;
      const month = parts[0].length === 4 ? p1 : p0;
      const day = parts[0].length === 4 ? p2 : p1;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else if (format === 'DMY') {
      let yr = y;
      if (parts[0].length === 4) yr = parts[0];
      const d = parts[0].length === 4 ? p2 : p0;
      const m = p1;
      return `${yr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    } else {
      let yr = y;
      if (parts[0].length === 4) yr = parts[0];
      const m = parts[0].length === 4 ? p1 : p0;
      const d = parts[0].length === 4 ? p2 : p1;
      return `${yr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseCleanAmount(s: string): number | null {
  if (s == null) return null;
  let cleaned = s.trim();
  if (cleaned === "") return null;
  
  let isNegative = false;
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  
  const lower = cleaned.toLowerCase();
  if (lower.endsWith("cr") || lower.endsWith("haben") || lower.endsWith("credit")) {
    isNegative = false;
    cleaned = cleaned.replace(/(cr|haben|credit)/gi, "").trim();
  } else if (lower.endsWith("dr") || lower.endsWith("soll") || lower.endsWith("debit") || lower.endsWith("db")) {
    isNegative = true;
    cleaned = cleaned.replace(/(dr|soll|debit|db)/gi, "").trim();
  }
  
  cleaned = cleaned.replace(/[$\u20AC\u00A3\u00A5]/g, "").trim();
  
  if (cleaned === "") return null;
  
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/[\s.]/g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/[\s,]/g, "");
  }
  
  let val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  if (isNegative) val = -Math.abs(val);
  return val;
}
