import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BookOpen, Camera, Clock3, Layers3, Loader2, Sparkles, Target, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LectureCard, LevelCard, Rail, SeriesCard } from "@/components/member/cards";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { InstallApp } from "@/components/member/InstallApp";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { getAvatarUploadUrl, getDashboard, saveAvatar } from "@/lib/member.functions";
import { putWithProgress } from "@/lib/upload-progress";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Skyline Dashboard — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your Skyline Achievers profile dashboard: member ID, rank, profile picture and the training levels you can open.",
      },
      { property: "og:title", content: "My Skyline Dashboard — Skyline Achievers" },
      { property: "og:description", content: "Your member profile and training levels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if (!data || data.blocked) {
    return (
      <MemberShell title="Access paused">
        <EmptyState
          title="Your membership is not active"
          hint="Please contact your Skyline Achievers administrator."
        />
      </MemberShell>
    );
  }

  const member = data.member;
  const totalContent = data.levels.reduce(
    (sum: number, level: any) => sum + (level.series_count ?? 0) + (level.lecture_count ?? 0),
    0,
  );
  const watchedSeconds = data.continueWatching.reduce(
    (sum: number, lecture: any) => sum + Math.min(lecture.position_seconds ?? 0, lecture.duration_seconds ?? 0),
    0,
  );
  const availableSeconds = data.continueWatching.reduce(
    (sum: number, lecture: any) => sum + (lecture.duration_seconds ?? 0),
    0,
  );
  const progress = availableSeconds > 0 ? Math.round((watchedSeconds / availableSeconds) * 100) : 0;

  return (
    <MemberShell
      title={member?.fullName ?? "Member"}
      subtitle={`${member?.memberId ?? ""} · ${member?.level?.name ?? "Level not assigned"}`}
      executive
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <aside className="raised-panel metal-edge overflow-hidden rounded-3xl animate-rise-in lg:col-span-4">
          <div className="relative h-24 brand-gradient"><div className="absolute inset-x-8 bottom-0 h-px bg-cyan/60" /></div>
          <div className="-mt-12 px-5 pb-6 text-center">
            <AvatarUploader name={member?.fullName ?? "Member"} url={member?.avatarUrl ?? null} />
            <p className="mt-4 text-[10px] font-bold uppercase text-primary">{BRAND.name} member</p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold">{member?.fullName ?? "Member"}</h1>
            <span className="mt-2 inline-flex rounded-xl border border-cyan/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-cyan shadow-glass">
              {member?.level?.name ?? "Level not assigned"}
            </span>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 text-left">
              <ProfileDetail label="Member ID" value={member?.memberId ?? "—"} />
              <ProfileDetail label="Joined" value={member ? formatDate(member.createdAt) : "—"} />
              <ProfileDetail label="Last active" value={member?.lastLoginAt ? formatDate(member.lastLoginAt) : "Today"} />
              <ProfileDetail label="Status" value="Active" />
            </div>
          </div>
        </aside>

        <section className="space-y-4 lg:col-span-8">
          <div className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in [animation-delay:70ms]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Training overview</p>
                <h2 className="mt-1 font-display text-xl font-bold">Your learning momentum</h2>
              </div>
               <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan/30 brand-gradient text-primary-foreground shadow-brand"><Activity className="h-5 w-5" /></span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={<Layers3 />} label="Levels" value={data.levels.length} tone="primary" />
              <Metric icon={<BookOpen />} label="Content" value={totalContent} tone="success" />
              <Metric icon={<Sparkles />} label="My series" value={data.mySeries.length} tone="warning" />
              <Metric icon={<Clock3 />} label="In progress" value={data.continueWatching.length} tone="accent" />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">Current watch progress</span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={<Trophy />} label="Current rank" value={member?.level?.name ?? "Unranked"} />
            <Stat icon={<Target />} label="Available paths" value={String(data.levels.length)} />
            <Stat icon={<BookOpen />} label="Series ready" value={String(data.mySeries.length)} className="col-span-2 sm:col-span-1" />
          </div>
        </section>
      </div>

      <div className="mt-6">
        <DailyInspiration />
      </div>

      {data.continueWatching.length > 0 ? (
        <section className="mt-7">
          <SectionTitle>Continue your progress</SectionTitle>
          <Rail>{data.continueWatching.map((lecture: any) => <LectureCard key={lecture.id} lecture={lecture} resume />)}</Rail>
        </section>
      ) : null}

      {data.mySeries.length > 0 ? (
        <section className="mt-7">
          <SectionTitle>Your current series</SectionTitle>
          <Rail>{data.mySeries.map((series: any) => <SeriesCard key={series.id} series={series} />)}</Rail>
        </section>
      ) : null}

      {/* ---------- levels: the only way into the videos ---------- */}
      <section className="mt-6">
        <SectionTitle>Watch your training</SectionTitle>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Tap a level below to open its series and lectures.
        </p>
        {data.levels.length === 0 ? (
          <EmptyState
            title="No training content yet"
            hint="Your administrator has not published anything for your rank yet."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.levels.map((level: any, index: number) => (
              <div
                key={level.id}
                className="animate-rise-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <LevelCard level={level} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 max-w-xl animate-rise-in">
        <InstallApp />
      </section>
    </MemberShell>
  );
}

function Stat({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
     <div className={`glass-panel metal-edge depth-hover rounded-2xl p-4 ${className ?? ""}`}>
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        {label}
      </span>
      <p className="mt-1.5 truncate font-display text-base font-semibold">{value}</p>
    </div>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>;
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "success" | "warning" | "accent" }) {
  const tones = { primary: "bg-primary/20 text-brand-glow", success: "bg-cyan/15 text-cyan", warning: "bg-brand/15 text-silver", accent: "bg-accent text-accent-foreground" };
  return <div className="inset-panel rounded-xl p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg border border-metal/20 ${tones[tone]} [&_svg]:h-4 [&_svg]:w-4`}>{icon}</span><p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p><p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p></div>;
}

function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const queryClient = useQueryClient();
  const createUrl = useServerFn(getAvatarUploadUrl);
  const store = useServerFn(saveAvatar);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const uploadProgress = useUploadProgress();

  async function upload(file: File) {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const extension = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
    setBusy(true);
    uploadProgress.clear();
    try {
      const slot = await createUrl({ data: { extension } } as never);
      await putWithProgress(slot.signedUrl, file, uploadProgress.handler("Uploading photo"));
      await store({ data: { path: slot.path } } as never);
      setPreview(URL.createObjectURL(file));
      toast.success("Profile picture updated");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["member-session"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  const shown = preview ?? url;

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-metal/40 bg-muted p-0 shadow-lift transition-transform duration-300 hover:-translate-y-1"
      aria-label="Upload profile picture"
    >
      {shown ? (
        <img src={shown} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-muted-foreground">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/70 py-1 text-[10px] text-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
        Change
      </span>
      {uploadProgress.state ? (
        <span className="absolute inset-0 flex items-center justify-center bg-background/75 text-sm font-semibold tabular-nums text-foreground">
          {uploadProgress.state.percent}%
        </span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
    </Button>
  );
}
