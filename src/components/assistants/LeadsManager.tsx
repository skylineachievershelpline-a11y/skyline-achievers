import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyLeads, reassignLeads, uploadLeads } from "@/lib/leads.functions";

type Row = { name: string | null; phone: string; city: string | null };
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

async function parseFile(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const pick = (r: Record<string, unknown>, keys: string[]) => {
    const k = Object.keys(r).find((x) => keys.some((w) => x.toLowerCase().includes(w)));
    return k ? String(r[k] ?? "").trim() : "";
  };
  return raw
    .map((r) => ({
      name: pick(r, ["name"]) || null,
      phone: pick(r, ["phone", "mobile", "number", "contact", "whatsapp"]),
      city: pick(r, ["city", "location"]) || null,
    }))
    .filter((r) => r.phone);
}

export function LeadsManager({ assistants }: { assistants: Assistant[] }) {
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
      toast.success(`${r.added} leads add, ${r.assigned} assign. Duplicate: ${r.duplicates}, galat number: ${r.invalid}`);
      setRows([]);
      setFileName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const distribute = useMutation({
    mutationFn: (assistantId: string) => move({ data: { fromUnassigned: true, assistantId } }),
    onSuccess: () => { toast.success("Unassigned leads de di gayi"); refresh(); },
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
        <SectionTitle>Leads upload karein (Excel / CSV)</SectionTitle>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <FileSpreadsheet className="size-8 text-primary" />
          {fileName ? `${fileName} — ${rows.length} rows` : "File choose karein (Name, Phone, City columns)"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const parsed = await parseFile(f);
                if (!parsed.length) { toast.error("File mein phone number wala column nahi mila."); return; }
                setRows(parsed.slice(0, 5000));
                setFileName(f.name);
              } catch {
                toast.error("File parh nahi saka.");
              }
              e.target.value = "";
            }}
          />
        </label>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {([["equal", "Barabar baantein"], ["custom", "Custom"], ["none", "Baad mein"]] as const).map(([m, l]) => (
                <Button key={m} variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{l}</Button>
              ))}
            </div>
            {mode === "equal" && (
              <p className="text-xs text-muted-foreground">
                {active.length ? `${active.length} active assistants mein barabar (~${Math.ceil(rows.length / active.length)} har ek).` : "Koi active assistant nahi — leads unassigned rahengi."}
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
                <p className="text-xs text-muted-foreground">Total {customTotal} / {rows.length}. Baaqi unassigned rahengi.</p>
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
            Sab unassigned leads do:
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
          {(data?.leads ?? []).length === 0 && <p className="py-3 text-muted-foreground">Koi lead nahi.</p>}
        </div>
      </section>
    </div>
  );
}
