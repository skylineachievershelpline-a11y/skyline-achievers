import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDeleteInspiration,
  adminGetInspirations,
  adminSaveInspiration,
} from "@/lib/admin-inspiration.functions";

type Kind = "ayat" | "hadees";
type Part = "morning" | "evening" | "night";

type FormState = {
  id?: string;
  kind: Kind;
  partOfDay: Part;
  textUr: string;
  textEn: string;
  reference: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: FormState = {
  kind: "ayat",
  partOfDay: "morning",
  textUr: "",
  textEn: "",
  reference: "",
  isActive: true,
  sortOrder: 0,
};

const PARTS: Part[] = ["morning", "evening", "night"];
const PART_LABEL: Record<Part, string> = {
  morning: "Morning",
  evening: "Evening",
  night: "Night",
};

/** Manage the daily Quran verses and hadees shown on member dashboards. */
export function InspirationTab() {
  const queryClient = useQueryClient();
  const loadList = useServerFn(adminGetInspirations);
  const save = useServerFn(adminSaveInspiration);
  const remove = useServerFn(adminDeleteInspiration);
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin-inspirations"],
    queryFn: () => loadList(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-inspirations"] });
  }

  const store = useMutation({
    mutationFn: (values: FormState) => save({ data: values } as never),
    onSuccess: () => {
      toast.success("Saved");
      setForm(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <SkylineLoader />
      </div>
    );
  }

  const items = (data?.items ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Members see one verse and one hadees, changing with morning, evening and night.
        </p>
        <Button variant="brand" className="rounded-2xl" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {form ? (
        <form
          className="glass-panel space-y-4 rounded-3xl p-5"
          onSubmit={(event) => {
            event.preventDefault();
            store.mutate(form);
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-semibold">
              {form.id ? "Edit item" : "New item"}
            </p>
            <button type="button" onClick={() => setForm(null)} aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(["ayat", "hadees"] as Kind[]).map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant={form.kind === kind ? "brand" : "outline"}
                    className="rounded-xl capitalize"
                    onClick={() => setForm({ ...form, kind })}
                  >
                    {kind === "ayat" ? "Quran verse" : "Hadees"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Time of day</Label>
              <div className="flex gap-2">
                {PARTS.map((part) => (
                  <Button
                    key={part}
                    type="button"
                    size="sm"
                    variant={form.partOfDay === part ? "brand" : "outline"}
                    className="rounded-xl"
                    onClick={() => setForm({ ...form, partOfDay: part })}
                  >
                    {PART_LABEL[part]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textUr">Urdu text</Label>
            <Textarea
              id="textUr"
              dir="rtl"
              rows={3}
              value={form.textUr}
              onChange={(event) => setForm({ ...form, textUr: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="textEn">English text</Label>
            <Textarea
              id="textEn"
              rows={3}
              value={form.textEn}
              onChange={(event) => setForm({ ...form, textEn: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                placeholder="Surah Ash-Sharh 94:6"
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Order</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: Number(event.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Visible</Label>
              <Button
                type="button"
                variant={form.isActive ? "brand" : "outline"}
                className="w-full rounded-xl"
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
              >
                {form.isActive ? "Shown to members" : "Hidden"}
              </Button>
            </div>
          </div>

          <Button type="submit" variant="brand" className="rounded-2xl" disabled={store.isPending}>
            {store.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground">
          Nothing added yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="glass-panel rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="rounded-full border border-hairline px-2 py-0.5">
                    {item.kind === "ayat" ? "Quran" : "Hadees"}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5">
                    {PART_LABEL[item.part_of_day as Part]}
                  </span>
                  {!item.is_active ? (
                    <span className="rounded-full border border-hairline px-2 py-0.5 text-destructive-foreground">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      setForm({
                        id: item.id,
                        kind: item.kind,
                        partOfDay: item.part_of_day,
                        textUr: item.text_ur ?? "",
                        textEn: item.text_en ?? "",
                        reference: item.reference ?? "",
                        isActive: item.is_active,
                        sortOrder: item.sort_order ?? 0,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={destroy.isPending}
                    onClick={() => destroy.mutate(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {item.text_ur ? (
                <p dir="rtl" className="mt-3 text-base leading-8">
                  {item.text_ur}
                </p>
              ) : null}
              {item.text_en ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.text_en}</p>
              ) : null}
              {item.reference ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-brand-glow">
                  {item.reference}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
