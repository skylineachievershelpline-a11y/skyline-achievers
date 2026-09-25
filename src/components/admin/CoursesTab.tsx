import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Eye, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { uploadToBucket } from "@/components/admin/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDecideEnrollment,
  adminDeleteCourse,
  adminDeleteCourseLesson,
  adminDeleteEnrollment,
  adminDeletePaymentMethod,
  adminGetCourseData,
  adminGrantCourseAccess,
  adminSaveCourse,
  adminSaveCourseLesson,
  adminSaveCoursePaymentSettings,
  adminSavePaymentMethod,
  adminSignPaymentProof,
} from "@/lib/admin-courses.functions";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  price_pkr: number;
  old_price_pkr: number | null;
  highlights: string[];
  duration_label: string | null;
  is_published: boolean;
  sort_order: number;
  thumbnail_url?: string | null;
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `PKR ${Number(value).toLocaleString("en-PK")}`;
}

export function CoursesTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetCourseData);
  const saveCourse = useServerFn(adminSaveCourse);
  const removeCourse = useServerFn(adminDeleteCourse);
  const saveLesson = useServerFn(adminSaveCourseLesson);
  const removeLesson = useServerFn(adminDeleteCourseLesson);
  const saveMethod = useServerFn(adminSavePaymentMethod);
  const removeMethod = useServerFn(adminDeletePaymentMethod);
  const saveSettings = useServerFn(adminSaveCoursePaymentSettings);
  const decide = useServerFn(adminDecideEnrollment);
  const removeRequest = useServerFn(adminDeleteEnrollment);
  const grant = useServerFn(adminGrantCourseAccess);
  const signProof = useServerFn(adminSignPaymentProof);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery({ queryKey: ["admin-courses"], queryFn: () => load() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-courses"] });

  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Course> & { highlightsText?: string }>({});
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grantCode, setGrantCode] = useState("");

  const courses = (data?.courses ?? []) as Course[];
  const lessons = (data?.lessons ?? []) as any[];
  const methods = (data?.methods ?? []) as any[];
  const requests = (data?.requests ?? []) as any[];
  const settings = data?.settings as any;

  const [intro, setIntro] = useState<string | null>(null);
  const [steps, setSteps] = useState<string | null>(null);
  const [support, setSupport] = useState<string | null>(null);
  const [turnaround, setTurnaround] = useState<string | null>(null);

  const courseSave = useMutation({
    mutationFn: async (thumbnailPath?: string) => {
      await saveCourse({
        data: {
          id: editing && editing !== "new" ? editing : null,
          title: (form.title ?? "").trim(),
          tagline: form.tagline ?? null,
          description: form.description ?? null,
          pricePkr: Number(form.price_pkr ?? 0),
          oldPricePkr: form.old_price_pkr ? Number(form.old_price_pkr) : null,
          highlights: (form.highlightsText ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          thumbnailPath: thumbnailPath ?? null,
          durationLabel: form.duration_label ?? null,
          isPublished: form.is_published ?? false,
          sortOrder: Number(form.sort_order ?? 0),
        } as never,
      });
    },
    onSuccess: async () => {
      toast.success("Course saved");
      setEditing(null);
      setForm({});
      await refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Course could not be saved."),
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);

  async function submitCourse() {
    if ((form.title ?? "").trim().length < 2) {
      toast.error("Enter the course title.");
      return;
    }
    setBusy(true);
    try {
      let path: string | undefined;
      if (coverFile) {
        path = await uploadToBucket(createUploadUrl as never, "training-thumbnails", coverFile);
      }
      await courseSave.mutateAsync(path);
      setCoverFile(null);
    } finally {
      setBusy(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading paid courses…
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* ---------- courses ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-brand-glow" />
            <h3 className="font-display text-sm font-semibold">Paid courses</h3>
          </div>
          <Button
            type="button"
            size="sm"
            className="min-w-fit rounded-xl"
            onClick={() => {
              setEditing("new");
              setForm({ is_published: false, sort_order: courses.length, price_pkr: 0 });
              setCoverFile(null);
            }}
          >
            <Plus className="h-4 w-4" /> New course
          </Button>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-cyan/20 bg-surface-2 p-4">
            <Input
              placeholder="Course title"
              value={form.title ?? ""}
              onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
            />
            <Input
              placeholder="Short tagline"
              value={form.tagline ?? ""}
              onChange={(event) => setForm((state) => ({ ...state, tagline: event.target.value }))}
            />
            <Textarea
              placeholder="Full description"
              value={form.description ?? ""}
              onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
            />
            <Textarea
              placeholder={"What they will learn — one line per point"}
              value={form.highlightsText ?? ""}
              onChange={(event) => setForm((state) => ({ ...state, highlightsText: event.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Price PKR"
                inputMode="numeric"
                value={String(form.price_pkr ?? "")}
                onChange={(event) =>
                  setForm((state) => ({ ...state, price_pkr: Number(event.target.value.replace(/[^0-9.]/g, "")) }))
                }
              />
              <Input
                placeholder="Old price (optional)"
                inputMode="numeric"
                value={String(form.old_price_pkr ?? "")}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    old_price_pkr: Number(event.target.value.replace(/[^0-9.]/g, "")),
                  }))
                }
              />
              <Input
                placeholder="Duration label (e.g. 12 hours)"
                value={form.duration_label ?? ""}
                onChange={(event) => setForm((state) => ({ ...state, duration_label: event.target.value }))}
              />
            </div>
            <label className="block text-xs text-muted-foreground">
              Cover image
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_published ?? false}
                onCheckedChange={(checked) => setForm((state) => ({ ...state, is_published: checked }))}
              />
              <span className="text-xs text-muted-foreground">Published (visible to members)</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" className="min-w-fit rounded-xl" disabled={busy} onClick={() => void submitCourse()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save course
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-w-fit rounded-xl"
                onClick={() => {
                  setEditing(null);
                  setForm({});
                }}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paid courses yet.</p>
          ) : (
            courses.map((course) => (
              <div key={course.id} className="rounded-2xl border border-hairline bg-surface p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold">{course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(course.price_pkr)} • {course.is_published ? "Published" : "Hidden"} •{" "}
                      {lessons.filter((lesson) => lesson.course_id === course.id).length} lessons
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={() => setOpenCourse(openCourse === course.id ? null : course.id)}
                  >
                    Lessons & access
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={() => {
                      setEditing(course.id);
                      setForm({ ...course, highlightsText: (course.highlights ?? []).join("\n") });
                      setCoverFile(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={async () => {
                      if (!confirm(`Delete "${course.title}" with all its lessons?`)) return;
                      await removeCourse({ data: { id: course.id } });
                      toast.success("Course deleted");
                      await refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {openCourse === course.id ? (
                  <div className="mt-3 space-y-4 rounded-2xl border border-cyan/20 bg-surface-2 p-3">
                    <LessonEditor
                      courseId={course.id}
                      lessons={lessons.filter((lesson) => lesson.course_id === course.id)}
                      onSaved={refresh}
                      saveLesson={saveLesson}
                      removeLesson={removeLesson}
                      createUploadUrl={createUploadUrl}
                    />

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Give access directly
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Input
                          placeholder="Member ID or Beginners ID"
                          value={grantCode}
                          onChange={(event) => setGrantCode(event.target.value)}
                          className="max-w-xs"
                        />
                        <Button
                          type="button"
                          className="min-w-fit rounded-xl"
                          onClick={async () => {
                            const result = await grant({ data: { courseId: course.id, code: grantCode.trim() } });
                            if (!result.ok) {
                              toast.error("No account was found for this ID.");
                              return;
                            }
                            toast.success(`Access given to ${result.name}`);
                            setGrantCode("");
                            await refresh();
                          }}
                        >
                          Unlock for this ID
                        </Button>
                      </div>
                      <div className="mt-3 space-y-1">
                        {requests
                          .filter((request) => request.course_id === course.id && request.status === "approved")
                          .map((request) => (
                            <p key={request.id} className="text-xs text-muted-foreground">
                              ✅ {request.buyer_name} ({request.buyer_code ?? "-"})
                            </p>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ---------- payment methods ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-4">
        <h3 className="font-display text-sm font-semibold">Payment accounts</h3>
        <p className="text-xs text-muted-foreground">
          These details are shown to members on the course page.
        </p>

        <div className="mt-3 space-y-2">
          {methods.map((method) => (
            <div key={method.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold">{method.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {method.account_name ?? "-"} • {method.account_number ?? "-"} •{" "}
                  {method.is_active ? "Active" : "Hidden"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-fit rounded-xl"
                onClick={async () => {
                  await saveMethod({
                    data: {
                      id: method.id,
                      label: method.label,
                      accountName: method.account_name,
                      accountNumber: method.account_number,
                      instructions: method.instructions,
                      isActive: !method.is_active,
                      sortOrder: method.sort_order,
                    } as never,
                  });
                  await refresh();
                }}
              >
                {method.is_active ? "Hide" : "Show"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="min-w-fit rounded-xl"
                onClick={async () => {
                  if (!confirm(`Delete ${method.label}?`)) return;
                  await removeMethod({ data: { id: method.id } });
                  await refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <MethodForm
          onSave={async (values) => {
            await saveMethod({ data: { ...values, sortOrder: methods.length } as never });
            toast.success("Payment account saved");
            await refresh();
          }}
        />
      </section>

      {/* ---------- payment instructions ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-4">
        <h3 className="font-display text-sm font-semibold">Payment instructions</h3>
        <div className="mt-3 space-y-3">
          <Textarea
            placeholder="Intro text"
            value={intro ?? settings?.intro ?? ""}
            onChange={(event) => setIntro(event.target.value)}
          />
          <Textarea
            placeholder="Step by step instructions"
            value={steps ?? settings?.steps ?? ""}
            onChange={(event) => setSteps(event.target.value)}
            rows={5}
          />
          <Input
            placeholder="Support contact (WhatsApp number or text)"
            value={support ?? settings?.support_contact ?? ""}
            onChange={(event) => setSupport(event.target.value)}
          />
          <Input
            placeholder="Turnaround note (e.g. Access within 24 hours)"
            value={turnaround ?? settings?.turnaround_note ?? ""}
            onChange={(event) => setTurnaround(event.target.value)}
          />
          <Button
            type="button"
            className="min-w-fit rounded-xl"
            onClick={async () => {
              await saveSettings({
                data: {
                  intro: intro ?? settings?.intro ?? null,
                  steps: steps ?? settings?.steps ?? null,
                  supportContact: support ?? settings?.support_contact ?? null,
                  turnaroundNote: turnaround ?? settings?.turnaround_note ?? null,
                } as never,
              });
              toast.success("Instructions saved");
              await refresh();
            }}
          >
            Save instructions
          </Button>
        </div>
      </section>

      {/* ---------- requests ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-4">
        <h3 className="font-display text-sm font-semibold">
          Payment requests {pendingCount > 0 ? `• ${pendingCount} pending` : ""}
        </h3>

        <div className="mt-3 space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment requests yet.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-hairline bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold">
                      {request.buyer_name} • {request.buyer_code ?? "-"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {request.paid_courses?.title ?? "Course"} • {money(request.amount_pkr)} •{" "}
                      {request.method_label ?? "-"} • TID {request.reference ?? "-"} • {request.phone ?? "-"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                      request.status === "approved"
                        ? "border-cyan/40 text-brand-glow"
                        : request.status === "rejected"
                          ? "border-red-400/40 text-red-300"
                          : "border-amber-400/40 text-amber-300",
                    )}
                  >
                    {request.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {request.proof_path ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-fit rounded-xl"
                      onClick={async () => {
                        const { url } = await signProof({ data: { path: request.proof_path } });
                        if (!url) {
                          toast.error("The screenshot could not be opened.");
                          return;
                        }
                        window.open(url, "_blank", "noopener");
                      }}
                    >
                      <Eye className="h-4 w-4" /> View screenshot
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={async () => {
                      await decide({ data: { id: request.id, status: "approved", adminNote: null } });
                      toast.success("Access approved");
                      await refresh();
                    }}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={async () => {
                      const note = prompt("Reason for rejection (shown to the member)") ?? "";
                      await decide({ data: { id: request.id, status: "rejected", adminNote: note } });
                      toast.success("Request rejected");
                      await refresh();
                    }}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-w-fit rounded-xl"
                    onClick={async () => {
                      if (!confirm("Delete this request?")) return;
                      await removeRequest({ data: { id: request.id } });
                      await refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {request.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">Note: {request.note}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MethodForm({
  onSave,
}: {
  onSave: (values: {
    label: string;
    accountName: string | null;
    accountNumber: string | null;
    instructions: string | null;
    qrUrl: string | null;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-4 space-y-2 rounded-2xl border border-cyan/20 bg-surface-2 p-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Add payment account</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Easypaisa / JazzCash / Bank" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="Account title" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        <Input placeholder="Account number / IBAN" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
      </div>
      <Input
        placeholder="QR code image link (optional — otherwise a QR is generated)"
        value={qrUrl}
        onChange={(e) => setQrUrl(e.target.value)}
      />
      <Textarea
        placeholder="Extra instructions (optional)"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        className="min-w-fit rounded-xl"
        disabled={busy}
        onClick={async () => {
          if (label.trim().length < 2) {
            toast.error("Enter the account name.");
            return;
          }
          setBusy(true);
          try {
            await onSave({
              label: label.trim(),
              accountName: accountName.trim() || null,
              accountNumber: accountNumber.trim() || null,
              instructions: instructions.trim() || null,
              qrUrl: qrUrl.trim() || null,
              isActive: true,
            });
            setLabel("");
            setAccountName("");
            setAccountNumber("");
            setInstructions("");
            setQrUrl("");

          } finally {
            setBusy(false);
          }
        }}
      >
        <Plus className="h-4 w-4" /> Add account
      </Button>
    </div>
  );
}

function LessonEditor({
  courseId,
  lessons,
  onSaved,
  saveLesson,
  removeLesson,
  createUploadUrl,
}: {
  courseId: string;
  lessons: any[];
  onSaved: () => Promise<unknown>;
  saveLesson: (args: { data: unknown }) => Promise<unknown>;
  removeLesson: (args: { data: { id: string } }) => Promise<unknown>;
  createUploadUrl: unknown;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [aspect, setAspect] = useState<"16/9" | "9/16" | "1/1" | "4/3">("16/9");
  const [isPreview, setIsPreview] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lessons</p>
      <div className="space-y-1">
        {lessons.length === 0 ? (
          <p className="text-xs text-muted-foreground">This course has no lessons yet.</p>
        ) : (
          lessons.map((lesson, index) => (
            <div key={lesson.id} className="flex items-center gap-2 rounded-xl border border-hairline bg-surface p-2">
              <span className="min-w-0 flex-1 truncate text-xs">
                {index + 1}. {lesson.title} {lesson.is_preview ? "• free preview" : ""}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="min-w-fit rounded-xl"
                onClick={async () => {
                  if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
                  await removeLesson({ data: { id: lesson.id } });
                  await onSaved();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-hairline bg-surface p-3">
        <Input placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Lesson description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Video file
            <input
              type="file"
              accept="video/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Thumbnail
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as typeof aspect)}
            className="rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-xs"
          >
            <option value="16/9">16/9 landscape</option>
            <option value="9/16">9/16 portrait</option>
            <option value="1/1">1/1 square</option>
            <option value="4/3">4/3</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} /> Free preview
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          className="min-w-fit rounded-xl"
          disabled={progress !== null}
          onClick={async () => {
            if (title.trim().length < 2) {
              toast.error("Enter the lesson title.");
              return;
            }
            if (!videoFile) {
              toast.error("Select a video for the lesson.");
              return;
            }
            setProgress(1);
            try {
              const videoPath = await uploadToBucket(
                createUploadUrl as never,
                "training-videos",
                videoFile,
                (percent) => setProgress(percent),
              );
              const thumbnailPath = thumbFile
                ? await uploadToBucket(createUploadUrl as never, "training-thumbnails", thumbFile)
                : null;
              await saveLesson({
                data: {
                  courseId,
                  title: title.trim(),
                  description: description.trim() || null,
                  videoSource: "upload",
                  videoPath,
                  videoUrl: null,
                  thumbnailPath,
                  aspectRatio: aspect,
                  isPreview,
                  isPublished: true,
                  sortOrder: lessons.length,
                },
              });
              toast.success("Lesson added");
              setTitle("");
              setDescription("");
              setVideoFile(null);
              setThumbFile(null);
              await onSaved();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The lesson could not be saved.");
            } finally {
              setProgress(null);
            }
          }}
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading {progress}%
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add lesson
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
