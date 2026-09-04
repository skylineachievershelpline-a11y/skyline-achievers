import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { uploadToBucket } from "@/components/admin/upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import {
  adminDeleteFinalTestQuestion,
  adminGetFinalTestDetail,
  adminGetFinalTestQuestions,
  adminGetFinalTestRules,
  adminGetFinalTests,
  adminSaveFinalTestQuestion,
  adminSaveFinalTestRules,
  adminSetAnswerMarks,
  adminSetFinalTestResult,
} from "@/lib/admin-finaltest.functions";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

type QuestionRow = {
  id: string;
  sort_order: number;
  question_en: string;
  question_ur: string | null;
  voice_url: string | null;
  question_type: "mcq" | "written";
  options_en: string[];
  options_ur: string[];
  correct_option: number | null;
  marks: number;
  time_limit_seconds: number;
  is_published: boolean;
};

type TestRow = {
  id: string;
  person_name: string;
  mobile: string;
  upline_name: string;
  status: string;
  marks: number | null;
  result: string;
};

export function FinalTestTab() {
  return (
    <Tabs defaultValue="questions">
      <TabsList className="rounded-2xl">
        <TabsTrigger value="questions" className="rounded-xl">
          Questions
        </TabsTrigger>
        <TabsTrigger value="rules" className="rounded-xl">
          Rules
        </TabsTrigger>
        <TabsTrigger value="records" className="rounded-xl">
          Records
        </TabsTrigger>
      </TabsList>
      <TabsContent value="questions" className="mt-5">
        <QuestionsPanel />
      </TabsContent>
      <TabsContent value="rules" className="mt-5">
        <RulesPanel />
      </TabsContent>
      <TabsContent value="records" className="mt-5">
        <RecordsPanel />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------- rules */

function RulesPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetFinalTestRules);
  const save = useServerFn(adminSaveFinalTestRules);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery({
    queryKey: ["admin-final-rules"],
    queryFn: () => load(),
  });

  const [ready, setReady] = useState(false);
  const [rulesEn, setRulesEn] = useState("");
  const [rulesUr, setRulesUr] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isPending && data && !ready) {
    const rules = (data as any).rules;
    setRulesEn(rules?.rules_en ?? "");
    setRulesUr(rules?.rules_ur ?? "");
    setVoiceUrl(rules?.voice_url ?? "");
    setShowResult(Boolean(rules?.show_result_to_candidate));
    setReady(true);
  }

  if (isPending) return <Spinner />;

  async function submit() {
    setBusy(true);
    try {
      let voicePath: string | null = null;
      if (voiceFile) {
        voicePath = await uploadToBucket(createUploadUrl, "training-resources", voiceFile);
      }
      await save({
        data: {
          rulesEn: rulesEn.trim() || null,
          rulesUr: rulesUr.trim() || null,
          voicePath,
          voiceUrl: voiceFile ? null : voiceUrl.trim() || null,
          showResult,
        },
      } as never);
      toast.success("Rules saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-final-rules"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-panel space-y-4 rounded-3xl p-5">
      <div className="space-y-2">
        <Label>English rules</Label>
        <Textarea
          value={rulesEn}
          onChange={(e) => setRulesEn(e.target.value)}
          className="min-h-32 rounded-2xl"
        />
      </div>
      <div className="space-y-2">
        <Label>Urdu rules</Label>
        <Textarea
          value={rulesUr}
          onChange={(e) => setRulesUr(e.target.value)}
          dir="rtl"
          className="min-h-32 rounded-2xl text-right"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Voice rules (audio file)</Label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setVoiceFile(e.target.files?.[0] ?? null)}
            className="text-xs text-muted-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label>Or voice link</Label>
          <Input
            value={voiceUrl}
            onChange={(e) => setVoiceUrl(e.target.value)}
            placeholder="https://..."
            className="h-11 rounded-2xl"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showResult}
          onChange={(e) => setShowResult(e.target.checked)}
        />
        Show the final result and marks to the candidate
      </label>
      <Button type="button" variant="brand" size="xl" disabled={busy} onClick={() => void submit()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save rules
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- questions */

function QuestionsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetFinalTestQuestions);
  const save = useServerFn(adminSaveFinalTestQuestion);
  const remove = useServerFn(adminDeleteFinalTestQuestion);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery({
    queryKey: ["admin-final-questions"],
    queryFn: () => load(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [questionEn, setQuestionEn] = useState("");
  const [questionUr, setQuestionUr] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [type, setType] = useState<"mcq" | "written">("mcq");
  const [optionsEn, setOptionsEn] = useState<string[]>(["", "", "", ""]);
  const [optionsUr, setOptionsUr] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState("0");
  const [marks, setMarks] = useState("1");
  const [timeLimit, setTimeLimit] = useState("60");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);

  function reset() {
    setEditing(null);
    setQuestionEn("");
    setQuestionUr("");
    setVoiceUrl("");
    setVoiceFile(null);
    setType("mcq");
    setOptionsEn(["", "", "", ""]);
    setOptionsUr(["", "", "", ""]);
    setCorrect("0");
    setMarks("1");
    setTimeLimit("60");
    setSortOrder("0");
    setPublished(true);
  }

  function startEdit(row: QuestionRow) {
    setEditing(row);
    setQuestionEn(row.question_en);
    setQuestionUr(row.question_ur ?? "");
    setVoiceUrl(row.voice_url ?? "");
    setVoiceFile(null);
    setType(row.question_type);
    setOptionsEn([...(row.options_en ?? []), "", "", "", ""].slice(0, 4));
    setOptionsUr([...(row.options_ur ?? []), "", "", "", ""].slice(0, 4));
    setCorrect(String(row.correct_option ?? 0));
    setMarks(String(row.marks));
    setTimeLimit(String(row.time_limit_seconds));
    setSortOrder(String(row.sort_order));
    setPublished(row.is_published);
    setOpen(true);
  }

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Question deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-final-questions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit() {
    if (!questionEn.trim()) {
      toast.error("The English question is required.");
      return;
    }
    setBusy(true);
    try {
      let voicePath: string | null = null;
      if (voiceFile) {
        voicePath = await uploadToBucket(createUploadUrl, "training-resources", voiceFile);
      }
      await save({
        data: {
          id: editing?.id,
          sortOrder: Number(sortOrder) || 0,
          questionEn: questionEn.trim(),
          questionUr: questionUr.trim() || null,
          voicePath,
          voiceUrl: voiceFile ? null : voiceUrl.trim() || null,
          questionType: type,
          optionsEn: optionsEn.map((o) => o.trim()).filter(Boolean),
          optionsUr: optionsUr.map((o) => o.trim()).filter(Boolean),
          correctOption: type === "mcq" ? Number(correct) || 0 : null,
          marks: Number(marks) || 0,
          timeLimitSeconds: Number(timeLimit) || 60,
          isPublished: published,
        },
      } as never);
      toast.success(editing ? "Question updated" : "Question added");
      setOpen(false);
      reset();
      void queryClient.invalidateQueries({ queryKey: ["admin-final-questions"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isPending || !data) return <Spinner />;
  const questions = ((data as any).questions ?? []) as QuestionRow[];

  return (
    <div className="space-y-4">
      <Button
        variant="brand"
        size="xl"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> New question
      </Button>

      {questions.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No Final Test questions yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {questions.map((row) => (
            <li key={row.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.question_en}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.question_type === "mcq" ? "MCQ" : "Written"} · {row.marks} marks ·{" "}
                  {row.time_limit_seconds}s · {row.is_published ? "Published" : "Hidden"}
                </p>
              </div>
              <button
                onClick={() => startEdit(row)}
                className="text-muted-foreground transition-colors hover:text-brand"
                aria-label="Edit question"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => del.mutate(row.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit question" : "New question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>English question</Label>
              <Textarea
                value={questionEn}
                onChange={(e) => setQuestionEn(e.target.value)}
                className="min-h-20 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Urdu question</Label>
              <Textarea
                value={questionUr}
                onChange={(e) => setQuestionUr(e.target.value)}
                dir="rtl"
                className="min-h-20 rounded-2xl text-right"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Voice (audio file)</Label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setVoiceFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label>Or voice link</Label>
                <Input
                  value={voiceUrl}
                  onChange={(e) => setVoiceUrl(e.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "mcq" | "written")}
                className={fieldClass}
              >
                <option value="mcq">MCQ</option>
                <option value="written">Written</option>
              </select>
            </div>

            {type === "mcq" ? (
              <div className="space-y-2">
                <Label>MCQ options</Label>
                {optionsEn.map((option, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={option}
                      placeholder={`English option ${i + 1}`}
                      onChange={(e) => {
                        const next = [...optionsEn];
                        next[i] = e.target.value;
                        setOptionsEn(next);
                      }}
                      className="h-11 rounded-2xl"
                    />
                    <Input
                      value={optionsUr[i] ?? ""}
                      placeholder={`Urdu option ${i + 1}`}
                      dir="rtl"
                      onChange={(e) => {
                        const next = [...optionsUr];
                        next[i] = e.target.value;
                        setOptionsUr(next);
                      }}
                      className="h-11 rounded-2xl text-right"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Correct answer</Label>
                  <select
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                    className={fieldClass}
                  >
                    {optionsEn.map((_, i) => (
                      <option key={i} value={String(i)}>
                        Option {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  inputMode="numeric"
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Time (sec)</Label>
                <Input
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  inputMode="numeric"
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Order</Label>
                <Input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  inputMode="numeric"
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published
            </label>

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add question"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------- records */

function RecordsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetFinalTests);
  const loadDetail = useServerFn(adminGetFinalTestDetail);
  const setMarks = useServerFn(adminSetAnswerMarks);
  const setResult = useServerFn(adminSetFinalTestResult);

  const { data, isPending } = useQuery({
    queryKey: ["admin-final-tests"],
    queryFn: () => load(),
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["admin-final-test-detail", openId],
    queryFn: () => loadDetail({ data: { id: openId as string } }),
    enabled: Boolean(openId),
  });

  if (isPending || !data) return <Spinner />;
  const tests = ((data as any).tests ?? []) as TestRow[];

  function printList(kind: "pass" | "fail") {
    const rows = tests.filter((t) => t.result === kind);
    const html = `<!doctype html><html><head><title>Final Test ${kind.toUpperCase()} list</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ccc;padding:8px;text-align:left}</style></head><body>
      <h1>Skyline Achievers — Final Test ${kind.toUpperCase()} list</h1>
      <table><thead><tr><th>Person name</th><th>Mobile number</th><th>Upline name</th><th>Marks</th><th>Result</th></tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr><td>${r.person_name}</td><td>${r.mobile}</td><td>${r.upline_name}</td><td>${
              r.marks ?? ""
            }</td><td>${r.result.toUpperCase()}</td></tr>`,
        )
        .join("")}</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to print the list.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => printList("pass")}>
          <Printer className="h-4 w-4" /> Print PASS list
        </Button>
        <Button variant="outline" className="rounded-2xl" onClick={() => printList("fail")}>
          <Printer className="h-4 w-4" /> Print FAIL list
        </Button>
      </div>

      {tests.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No Final Test records yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {tests.map((row) => (
            <li key={row.id} className="glass-panel rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.person_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.mobile} · Upline {row.upline_name} ·{" "}
                    {row.status === "completed"
                      ? "Completed"
                      : row.status === "in_progress"
                        ? "In progress"
                        : "Not started"}{" "}
                    · Marks {row.marks ?? "—"} ·{" "}
                    {row.result === "pending" ? "Pending" : row.result.toUpperCase()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setOpenId(row.id)}
                >
                  Check answers
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(openId)} onOpenChange={(open) => (open ? null : setOpenId(null))}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Check answers</DialogTitle>
          </DialogHeader>
          {detail.isPending || !detail.data ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {(detail.data as any).test.person_name} · {(detail.data as any).test.mobile} ·
                Upline {(detail.data as any).test.upline_name}
              </p>
              {((detail.data as any).rows ?? []).map((row: any) => (
                <div key={row.question.id} className="rounded-2xl border border-hairline p-3">
                  <p className="text-sm font-medium">{row.question.question_en}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.question.question_type === "mcq"
                      ? `Correct: ${
                          row.question.options_en?.[row.question.correct_option ?? -1] ?? "—"
                        }`
                      : "Written answer"}{" "}
                    · Max marks {row.question.marks}
                  </p>
                  <p className="mt-2 text-sm">
                    Answer:{" "}
                    {row.answer
                      ? row.question.question_type === "mcq"
                        ? (row.question.options_en?.[row.answer.selected_option ?? -1] ??
                          "Not answered")
                        : (row.answer.answer_text ?? "Not answered")
                      : "Not answered"}
                  </p>
                  {row.answer ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        defaultValue={String(row.answer.awarded_marks ?? "")}
                        placeholder="Marks"
                        inputMode="numeric"
                        className="h-10 w-28 rounded-2xl"
                        onBlur={async (e) => {
                          const value = Number(e.target.value);
                          if (Number.isNaN(value)) return;
                          await setMarks({ data: { answerId: row.answer.id, marks: value } });
                          toast.success("Marks saved");
                          void detail.refetch();
                        }}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Marks assigned for this question
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                {(["pass", "fail", "pending"] as const).map((value) => (
                  <Button
                    key={value}
                    variant={value === "pass" ? "brand" : "outline"}
                    className="rounded-2xl"
                    onClick={async () => {
                      const res: any = await setResult({
                        data: { id: openId as string, result: value },
                      });
                      toast.success(`Result saved · total marks ${res.marks}`);
                      void queryClient.invalidateQueries({ queryKey: ["admin-final-tests"] });
                      void detail.refetch();
                    }}
                  >
                    Mark {value.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
    </div>
  );
}
