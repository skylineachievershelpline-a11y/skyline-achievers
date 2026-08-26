import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Sparkles, Target, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LevelCard } from "@/components/member/cards";
import { InstallApp } from "@/components/member/InstallApp";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { getAvatarUploadUrl, getDashboard, saveAvatar } from "@/lib/member.functions";

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

  return (
    <MemberShell
      title={member?.fullName ?? "Member"}
      subtitle={`${member?.memberId ?? ""} · ${member?.level?.name ?? "Level not assigned"}`}
    >
      {/* ---------- identity card ---------- */}
      <section className="glass-panel-strong relative mb-6 overflow-hidden rounded-3xl animate-rise-in">
        <div className="spotlight pointer-events-none absolute inset-0 animate-glow" aria-hidden />
        <div className="relative flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:text-left">
          <AvatarUploader name={member?.fullName ?? "Member"} url={member?.avatarUrl ?? null} />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-brand-glow">
              {BRAND.name} member
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {member?.fullName ?? "Member"}
            </h1>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Chip icon={<Trophy className="h-3.5 w-3.5" />} label={member?.level?.name ?? "Unranked"} />
              <Chip icon={<Target className="h-3.5 w-3.5" />} label={member?.memberId ?? "—"} />
              {member ? (
                <Chip icon={<Sparkles className="h-3.5 w-3.5" />} label={`Joined ${formatDate(member.createdAt)}`} />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- about ---------- */}
      <section className="glass-panel mb-6 rounded-3xl p-6 animate-rise-in [animation-delay:80ms]">
        <SectionTitle className="mb-2">About {BRAND.name}</SectionTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {BRAND.name} is a rank-based training academy built for people who want to grow fast and lead
          with confidence. Every level unlocks a new stage of your journey — from your first steps as a
          beginner, through personal mentorship, all the way to full management training.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your rank decides what you can watch. Move up, and the next library opens automatically.
        </p>
        <p className="mt-4 font-display text-sm font-semibold brand-text">{BRAND.tagline}</p>
      </section>

      {/* ---------- levels: the only way into the videos ---------- */}
      <section className="mb-6">
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

      <section className="mb-2 max-w-xl animate-rise-in">
        <InstallApp />
      </section>
    </MemberShell>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-hairline bg-glass px-3 py-1 text-[11px] font-medium">
      <span className="text-brand-glow">{icon}</span>
      {label}
    </span>
  );
}

function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const queryClient = useQueryClient();
  const createUrl = useServerFn(getAvatarUploadUrl);
  const store = useServerFn(saveAvatar);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(file: File) {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const extension = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "jpg";
    setBusy(true);
    try {
      const slot = await createUrl({ data: { extension } } as never);
      const response = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed. Please try again.");
      await store({ data: { path: slot.path } } as never);
      setPreview(URL.createObjectURL(file));
      toast.success("Profile picture updated");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["member-session"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? url;

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface-2 shadow-[var(--shadow-brand)] transition-transform duration-300 hover:scale-105"
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
    </button>
  );
}
