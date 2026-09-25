import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock3,
  Copy,
  CreditCard,
  ImagePlus,
  Loader2,
  Lock,
  PlayCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compressImageForUpload } from "@/components/admin/upload";
import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
import { createProofUploadUrl, getCourseDetail, submitCoursePayment } from "@/lib/courses.functions";
import { putWithProgress } from "@/lib/upload-progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/course/$courseId")({
  head: () => ({
    meta: [
      { title: "Premium Course — Skyline Achievers" },
      {
        name: "description",
        content:
          "Skyline Achievers premium course: payment details, screenshot upload and full lesson library after verification.",
      },
      { property: "og:title", content: "Premium Course — Skyline Achievers" },
      {
        property: "og:description",
        content: "Pay, upload your screenshot and unlock this Skyline Achievers premium course.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourseDetailPage,
});

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return `PKR ${Number(value).toLocaleString("en-PK")}`;
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="truncate font-display text-sm font-semibold">{value}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-fit rounded-xl"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </Button>
    </div>
  );
}

function CourseDetailPage() {
  const ready = useMemberGuard();
  const { courseId } = useParams({ from: "/course/$courseId" });
  const queryClient = useQueryClient();
  const load = useServerFn(getCourseDetail);
  const createUrl = useServerFn(createProofUploadUrl);
  const submit = useServerFn(submitCoursePayment);

  const [method, setMethod] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofPath, setProofPath] = useState("");
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [slip, setSlip] = useState<PaymentSlipData | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["course-detail", courseId],
    queryFn: () => load({ data: { courseId } }),
    enabled: ready,
  });

  const send = useMutation({
    mutationFn: async () => {
      const result = await submit({
        data: {
          courseId,
          phone: phone.trim(),
          methodLabel: method,
          amount: Number(amount),
          reference: reference.trim(),
          proofPath,
          note: note.trim() || null,
        },
      });
      if (!result.ok) throw new Error("This course is not available right now.");
      return result;
    },
    onSuccess: async () => {
      if (data?.status === "ok") {
        setSlip({
          courseTitle: data.course.title,
          buyerName: data.identity.name,
          buyerId: data.identity.code,
          method: method.trim(),
          amount: Number(amount),
          reference: reference.trim(),
          phone: (phone || data.identity.phone || "").trim(),
          submittedAt: new Date(),
        });
      }
      toast.success("Payment sent for verification. Access within 24 hours.");
      await queryClient.invalidateQueries({ queryKey: ["course-detail", courseId] });
      await queryClient.invalidateQueries({ queryKey: ["course-catalog"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not submit. Please try again."),
  });

  async function pickProof(file: File | null) {
    if (!file) return;
    try {
      setProgress(1);
      const ready = file.type.startsWith("image/") ? await compressImageForUpload(file, 900_000) : file;
      const slot = await createUrl({ data: { fileName: ready.name } });
      await putWithProgress(slot.signedUrl, ready, (percent) => setProgress(percent));
      setProofPath(slot.path);
      setProofPreview(URL.createObjectURL(ready));
      setProgress(null);
      toast.success("Screenshot uploaded");
    } catch (error) {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
    }
  }

  if (!ready || isPending) {
    return (
      <MemberShell title="Premium Course" executive>
        <SkylineLoader label="Opening course" />
      </MemberShell>
    );
  }

  if (!data || data.status !== "ok") {
    return (
      <MemberShell title="Premium Course" executive>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <EmptyState title="This course is not available" hint="Please go back and pick another course." />
          <Button asChild variant="outline" className="mt-4 rounded-xl">
            <Link to="/courses">
              <ArrowLeft className="h-4 w-4" /> Back to courses
            </Link>
          </Button>
        </div>
      </MemberShell>
    );
  }

  const { course, lessons, methods, settings, enrollment, unlocked, identity } = data;
  const pending = enrollment?.status === "pending";
  const rejected = enrollment?.status === "rejected";
  const activeLesson = lessons.find((lesson) => lesson.id === playing) ?? null;

  return (
    <MemberShell title={course.title} subtitle="Skyline Achievers premium course" executive>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <Button asChild variant="outline" size="sm" className="min-w-fit rounded-xl">
          <Link to="/courses">
            <ArrowLeft className="h-4 w-4" /> Back to courses
          </Link>
        </Button>

        {/* ---------- hero ---------- */}
        <section className="raised-panel relative overflow-hidden rounded-[30px]">
          <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
            {course.coverUrl ? (
              <img src={course.coverUrl} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-brand-glow">
                <PlayCircle className="h-12 w-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur",
                  unlocked
                    ? "border-cyan/40 text-brand-glow"
                    : pending
                      ? "border-amber-400/40 text-amber-300"
                      : "border-metal/30 text-muted-foreground",
                )}
              >
                {unlocked ? <BadgeCheck className="h-3 w-3" /> : pending ? <Clock3 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {unlocked ? "Unlocked" : pending ? "Under review" : "Premium"}
              </span>
              <h1 className="mt-2 font-display text-xl font-semibold">{course.title}</h1>
              {course.tagline ? (
                <p className="mt-1 text-xs text-muted-foreground">{course.tagline}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 p-5">
            <div>
              <p className="font-display text-2xl font-semibold text-brand-glow">
                {money(course.price_pkr)}
              </p>
              {course.old_price_pkr ? (
                <p className="text-xs text-muted-foreground line-through">
                  {money(course.old_price_pkr)}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
              {course.duration_label ? ` • ${course.duration_label}` : ""}
            </p>
          </div>

          {course.description ? (
            <p className="whitespace-pre-line px-5 pb-5 text-sm text-muted-foreground">
              {course.description}
            </p>
          ) : null}

          {course.highlights && course.highlights.length > 0 ? (
            <ul className="grid gap-2 px-5 pb-6 sm:grid-cols-2">
              {course.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-glow" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ---------- payment ---------- */}
        {!unlocked ? (
          <section className="raised-panel rounded-[28px] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/15 text-brand-glow">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">Payment & enrollment</h2>
                <p className="text-xs text-muted-foreground">
                  {settings?.turnaround_note ?? "Access within 24 hours after verification."}
                </p>
              </div>
            </div>

            {settings?.intro ? (
              <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{settings.intro}</p>
            ) : null}
            {settings?.steps ? (
              <div className="mt-3 rounded-2xl border border-hairline bg-surface-2 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  How it works
                </p>
                <p className="mt-2 whitespace-pre-line text-sm">{settings.steps}</p>
              </div>
            ) : null}

            {pending ? (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
                <p className="font-display font-semibold text-amber-200">Payment under review</p>
                <p className="mt-1 text-xs text-amber-100/80">
                  We received your screenshot. The course will unlock within 24 hours after verification.
                </p>
              </div>
            ) : null}
            {rejected ? (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm">
                <p className="font-display font-semibold text-red-200">Payment not verified</p>
                <p className="mt-1 text-xs text-red-100/80">
                  {enrollment?.admin_note ?? "Please send the correct payment and upload the screenshot again."}
                </p>
              </div>
            ) : null}

            {/* accounts */}
            <div className="mt-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Payment accounts
              </p>
              {methods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payment account is available yet. Please check again later.
                </p>
              ) : (
                <PaymentMethodWallet
                  methods={methods.map((item) => ({
                    name: item.label,
                    accountTitle: item.account_name ?? "",
                    accountNumber: item.account_number ?? "",
                    instructions: item.instructions ?? "",
                    qrUrl: (item as { qr_url?: string | null }).qr_url ?? "",
                  }))}
                  selectedName={method}
                  onSelect={(name) => setMethod(name)}
                />
              )}

            </div>

            {/* form */}
            <div className="mt-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Upload payment screenshot
              </p>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-cyan/30 bg-surface-2 p-4 text-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan/30 bg-primary/15 text-brand-glow">
                  {progress !== null ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : proofPath ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-semibold">
                    {proofPath ? "Screenshot uploaded" : "Choose payment screenshot"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {progress !== null ? `Uploading ${progress}%` : "JPG or PNG, max 15MB"}
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void pickProof(event.target.files?.[0] ?? null)}
                />
              </label>

              {proofPreview ? (
                <img
                  src={proofPreview}
                  alt="Payment screenshot preview"
                  className="max-h-64 w-full rounded-2xl border border-hairline object-contain"
                />
              ) : null}

              <Input
                placeholder="Payment method (e.g. Easypaisa)"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="Amount you sent (PKR)"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                className="rounded-xl"
              />
              <Input
                placeholder="Transaction ID / TID"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="rounded-xl"
              />
              <Input
                placeholder="Your WhatsApp number"
                value={phone || identity.phone || ""}
                onChange={(event) => setPhone(event.target.value)}
                className="rounded-xl"
              />
              <Textarea
                placeholder="Any note for the team (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="rounded-xl"
              />

              <Button
                type="button"
                className="w-full rounded-xl font-display"
                disabled={send.isPending || progress !== null}
                onClick={() => {
                  if (!proofPath) {
                    toast.error("Upload your payment screenshot first.");
                    return;
                  }
                  if (!method.trim()) {
                    toast.error("Enter or select a payment method.");
                    return;
                  }
                  if (!Number(amount)) {
                    toast.error("Enter the amount you sent.");
                    return;
                  }
                  if (reference.trim().length < 3) {
                    toast.error("Enter the transaction ID.");
                    return;
                  }
                  const number = (phone || identity.phone || "").trim();
                  if (number.length < 7) {
                    toast.error("Enter your WhatsApp number.");
                    return;
                  }
                  setPhone(number);
                  send.mutate();
                }}
              >
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {pending ? "Resubmit payment" : "Submit payment for verification"}
              </Button>

              {settings?.support_contact ? (
                <p className="text-center text-xs text-muted-foreground">
                  Need help? {settings.support_contact}
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="raised-panel rounded-[28px] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/15 text-brand-glow">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">Access unlocked</h2>
                <p className="text-xs text-muted-foreground">
                  {identity.name}, the complete course is now open for you.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ---------- lessons ---------- */}
        <section className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Course content
          </p>

          {activeLesson?.url ? (
            <div className="raised-panel overflow-hidden rounded-[26px]">
              <video
                src={activeLesson.url}
                poster={activeLesson.thumbnailUrl ?? undefined}
                controls
                autoPlay
                playsInline
                controlsList="nodownload"
                className="max-h-[70vh] w-full bg-black object-contain"
                style={{ aspectRatio: activeLesson.aspectRatio ?? "16/9" }}
              />
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold">{activeLesson.title}</p>
                  {activeLesson.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {activeLesson.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-w-fit rounded-xl"
                  onClick={() => setPlaying(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}

          {lessons.length === 0 ? (
            <EmptyState title="Lessons coming soon" hint="Course lessons will be added here soon." />
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  type="button"
                  disabled={lesson.locked}
                  onClick={() => setPlaying(lesson.id)}
                  className={cn(
                    "glass-panel metal-edge flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors",
                    lesson.locked ? "opacity-60" : "hover:border-cyan/30",
                  )}
                >
                  <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {lesson.thumbnailUrl ? (
                      <img src={lesson.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-brand-glow">
                        <PlayCircle className="h-5 w-5" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold">
                      {index + 1}. {lesson.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lesson.locked
                        ? "Locked — unlocks after payment verification"
                        : lesson.isPreview && !unlocked
                          ? "Free preview"
                          : (lesson.description ?? "Watch now")}
                    </span>
                  </span>
                  {lesson.locked ? (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <PlayCircle className="h-5 w-5 shrink-0 text-brand-glow" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <PaymentSlip open={slip !== null} data={slip} onClose={() => setSlip(null)} />
    </MemberShell>
  );
}
