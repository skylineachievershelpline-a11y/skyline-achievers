import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyLeads, reassignLeads, uploadLeads } from "@/lib/leads.functions";

type Row = { name: string | null; phone: string; city: string | null; age: number | null; qualification: string | null };
type Assistant = { id: string; full_name: string; status: string };

const STATUS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow-up",
  enrolled: "Enrolled",
  not_interested: "Not interested",
  cc_done: "2CC done",
  invalid: "Invalid",
};

const HEADER_KEYS = {
  name: ["name"],
  phone: ["phone", "mobile", "number", "contact", "whatsapp", "cell"],
  city: ["city", "location", "shehar", "address"],
  age: ["age", "umar"],
  qualification: ["qualification", "education", "degree", "taleem"],
} as const;
type Field = keyof typeof HEADER_KEYS;

const CITIES = /karachi|lahore|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|sialkot|gujranwala|hyderabad|sargodha|bahawalpur|sukkur|sadiqabad|rahim|chitral|abbottabad|mardan|gujrat|jhelum|sahiwal|okara|kasur|sheikhupura|larkana|nawabshah|dera|mirpur|muzaffarabad|swat|mansehra|khanewal|vehari|jhang|chiniot|attock|chakwal|mianwali|bhakkar|layyah|lodhran|pakpattan|narowal|hafizabad|mandi|toba|kohat|bannu|gilgit|skardu|taxila|wah|murree|haripur|nowshera|charsadda|swabi|thatta|badin|jacobabad|shikarpur|khairpur|dadu|turbat|gwadar|kotli|bhimber|burewala|kamalia|arifwala|shorkot|daska|wazirabad|kharian|chichawatni/i;
const QUAL = /student|matric|inter|fsc|fa\b|f\.a|ba\b|b\.a|bs|bsc|bscs|ma\b|m\.a|msc|mba|mphil|phd|university|college|semester|graduat|master|bachelor|degree|school|class|middle|primary|dae|diploma|icom|i\.com|bcom|b\.com|ics|hafiz|uneducated|none|nil/i;
const phoneLike = (v: string) => /^\+?\d[\d\s-]{9,15}$/.test(v) && v.replace(/\D/g, "").length >= 10;

async function parseFile(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const grid = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false })
    .map((r) => r.map((c) => String(c ?? "").trim()))
    .filter((r) => r.some(Boolean));
  if (!grid.length) return [];

  // 1) Header row present?
  const first = grid[0]!;
  const cols: { [K in Field]?: number | undefined } = {};
  const firstHasPhone = first.some(phoneLike);
  if (!firstHasPhone) {
    (Object.keys(HEADER_KEYS) as Field[]).forEach((f) => {
      const i = first.findIndex((h) => HEADER_KEYS[f].some((k) => h.toLowerCase().includes(k)));
      if (i >= 0 && !Object.values(cols).includes(i)) cols[f] = i;
    });
  }
  const hasHeader = cols.phone !== undefined;
  const body = hasHeader ? grid.slice(1) : grid;

  // 2) No header: detect each column by its content.
  if (!hasHeader) {
    const width = Math.max(...body.map((r) => r.length));
    const sample = body.slice(0, 50);
    const share = (i: number, test: (v: string) => boolean) => {
      const vals = sample.map((r) => r[i] ?? "").filter(Boolean);
      return vals.length ? vals.filter(test).length / vals.length : 0;
    };
    const used = new Set<number>();
    const best = (test: (v: string) => boolean, min = 0.6) => {
      let pick = -1, score = min;
      for (let i = 0; i < width; i++) {
        if (used.has(i)) continue;
        const s = share(i, test);
        if (s >= score) { score = s; pick = i; }
      }
      if (pick >= 0) used.add(pick);
      return pick >= 0 ? pick : undefined;
    };
    // Skip date/time, gender and yes/no answer columns.
    best((v) => /\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}:\d{2}/.test(v));
    best((v) => /^(male|female|m|f)$/i.test(v));
    best((v) => /^(yes|no|haan|nahi)\b/i.test(v));
    cols.phone = best(phoneLike, 0.5);
    cols.age = best((v) => /^\d{1,3}$/.test(v) && +v >= 12 && +v <= 100);
    cols.city = best((v) => CITIES.test(v), 0.4);
    cols.qualification = best((v) => QUAL.test(v), 0.4);
    cols.name = best((v) => /^[\p{L} .'-]{2,}$/u.test(v), 0.5);
  }

  const get = (r: string[], f: Field) => (cols[f] !== undefined ? (r[cols[f]!] ?? "").trim() : "");
  return body
    .map((r) => {
      let phone = get(r, "phone");
      if (!phoneLike(phone)) phone = r.find(phoneLike) ?? "";
      return {
        name: get(r, "name").slice(0, 100) || null,
        phone,
        city: get(r, "city").slice(0, 60) || null,
        age: (() => { const n = Number(get(r, "age")); return n >= 12 && n <= 100 ? Math.round(n) : null; })(),
        qualification: get(r, "qualification").slice(0, 100) || null,
      };
    })
    .filter((r) => r.phone);
}

export function LeadsManager({ assistants = [] }: { assistants?: Assistant[] }) {
  const qc = useQueryClient();
  const load = useServerFn(getMyLeads);
  const upload = useServerFn(uploadLeads);
  const move = useServerFn(reassignLeads);
  const active = assistants.filter((a) => a.status === "active");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"equal" | "custom" | "none">("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");

  const { data } = useQuery({ queryKey: ["my-leads", filter], queryFn: () => load({ data: { filter } }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my-leads"] });
  const nameOf = (id: string | null) => assistants.find((a) => a.id === id)?.full_name ?? "Unassigned";

  const send = useMutation({
    mutationFn: () =>
      upload({
        data: {
          rows,
          mode,
          batchLabel: fileName.slice(0, 60),
          custom: Object.entries(custom).map(([assistantId, v]) => ({ assistantId, count: Number(v) || 0 })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.added} leads added, ${r.assigned} assigned. Duplicates: ${r.duplicates}, invalid: ${r.invalid}`);
      setRows([]);
      setFileName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const distribute = useMutation({
    mutationFn: (assistantId: string) => move({ data: { fromUnassigned: true, assistantId } }),
    onSuccess: () => { toast.success("Unassigned leads assigned"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const moveOne = useMutation({
    mutationFn: (v: { id: string; assistantId: string | null }) =>
      move({ data: { leadIds: [v.id], assistantId: v.assistantId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const customTotal = Object.values(custom).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <SectionTitle>Upload leads (Excel / CSV)</SectionTitle>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <FileSpreadsheet className="size-8 text-primary" />
          {fileName ? `${fileName} — ${rows.length} rows` : "Choose a file (Name, Phone, City, Age, Qualification)"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const parsed = await parseFile(f);
                if (!parsed.length) { toast.error("No phone-number column was found in this file."); return; }
                setRows(parsed.slice(0, 5000));
                setFileName(f.name);
              } catch {
                  toast.error("The file could not be read.");
              }
              e.target.value = "";
            }}
          />
        </label>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
               {([["equal", "Equal batches"], ["custom", "Custom"], ["none", "Keep unassigned"]] as const).map(([m, l]) => (
                <Button key={m} variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{l}</Button>
              ))}
            </div>
            {mode === "equal" && (
              <p className="text-xs text-muted-foreground">
                 {active.length ? `Complete 10-lead batches will rotate across ${active.length} active executives. Leftovers stay unassigned.` : "No active executive — leads will stay unassigned."}
              </p>
            )}
            {mode === "custom" && (
              <div className="space-y-2">
                {active.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{a.full_name}</span>
                    <Input className="w-24" inputMode="numeric" value={custom[a.id] ?? ""} onChange={(e) => setCustom({ ...custom, [a.id]: e.target.value })} />
                  </div>
                ))}
                 <p className="text-xs text-muted-foreground">Total {customTotal} / {rows.length}. Use 10, 20, 30… per executive; leftovers stay unassigned.</p>
              </div>
            )}
            <Button className="w-full" disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload {rows.length} leads
            </Button>
          </>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <SectionTitle>Leads ({data?.total ?? 0})</SectionTitle>
        <div className="flex flex-wrap gap-2 text-xs">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "unassigned" ? "default" : "outline"} onClick={() => setFilter("unassigned")}>
            Unassigned ({data?.unassigned ?? 0})
          </Button>
          {assistants.map((a) => (
            <Button key={a.id} size="sm" variant={filter === a.id ? "default" : "outline"} onClick={() => setFilter(a.id)}>
              {a.full_name} ({data?.counts[a.id] ?? 0})
            </Button>
          ))}
        </div>
        {filter === "unassigned" && (data?.unassigned ?? 0) > 0 && active.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
             Assign all unassigned leads to:
            {active.map((a) => (
              <Button key={a.id} size="sm" variant="outline" disabled={distribute.isPending} onClick={() => distribute.mutate(a.id)}>
                {a.full_name}
              </Button>
            ))}
          </div>
        )}
        <div className="divide-y divide-border/40 text-sm">
          {(data?.leads ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{l.full_name ?? "—"} <span className="text-muted-foreground">· {l.phone}</span></p>
                <p className="text-xs text-muted-foreground">{l.city ?? ""} {STATUS[l.status]} · {nameOf(l.assistant_id)}</p>
              </div>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                value={l.assistant_id ?? ""}
                onChange={(e) => moveOne.mutate({ id: l.id, assistantId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {active.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          ))}
           {(data?.leads ?? []).length === 0 && <p className="py-3 text-muted-foreground">No leads yet.</p>}
        </div>
      </section>
    </div>
  );
}
