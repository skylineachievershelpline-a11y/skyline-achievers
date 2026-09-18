import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Lock, Sparkles, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import skylineBackground from "@/assets/skyline-landing-bg-clean.jpg";
import { AnnouncementBanner } from "@/components/member/AnnouncementBanner";
import { AvatarPicker } from "@/components/member/AvatarPicker";
import { LectureCard, Rail } from "@/components/member/cards";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { EarningsPanel } from "@/components/member/EarningsPanel";
import {
  MemberShell,
  SectionTitle,
  useMemberGuard,
  useTrainingOnly,
} from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getDashboard, getSessionRole } from "@/lib/member.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Skyline Dashboard — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your Skyline Achievers profile dashboard: member ID, rank, profile picture and every training video unlocked for you.",
      },
      { property: "og:title", content: "My Skyline Dashboard — Skyline Achievers" },
      { property: "og:description", content: "Your member profile and training videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const ready = useMemberGuard();
  const trainingOnly = useTrainingOnly();
  const [showId, setShowId] = useState(false);
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
    return <NoMemberAccess hasProfile={Boolean(data?.member)} />;
  }

  const member = data.member;

  return (
    <MemberShell
      title={member?.fullName ?? "Member"}
      subtitle={member?.level?.name ?? "Level not assigned"}
      executive
    >
      <AnnouncementBanner />

      <section className="raised-panel metal-edge relative min-h-[24rem] overflow-hidden rounded-3xl animate-rise-in sm:min-h-[26rem]">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={skylineBackground}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-background/20" />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-background/95 via-background/55 to-transparent" />
        </div>
        <div className="relative z-10 flex min-h-[24rem] flex-col justify-between p-5 sm:min-h-[26rem] sm:p-7">
          <div className="max-w-[75%]">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan">
              <Sparkles className="h-3.5 w-3.5" /> Welcome back
            </p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">
              {member?.fullName ?? "Member"}
            </h1>
            <p className="mt-1 text-xs text-foreground/70">Here&apos;s your Skyline progress today.</p>
          </div>

          <div className="glass-panel-strong metal-edge grid gap-5 rounded-3xl p-4 backdrop-blur-md sm:grid-cols-[auto_1fr_auto] sm:items-end sm:p-5">
            <AvatarPicker
              name={member?.fullName ?? "Member"}
              url={member?.avatarUrl ?? null}
              label="Change picture"
              hint=""
            />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase text-primary">{BRAND.name} member</p>
              <h2 className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">
                {member?.fullName ?? "Member"}
              </h2>
              <span className="mt-2 inline-flex rounded-xl border border-cyan/30 bg-primary/15 px-3 py-1 text-xs font-semibold text-cyan shadow-glass">
                {member?.level?.name ?? "Level not assigned"}
              </span>
            </div>
            <div className="inset-panel min-w-0 rounded-2xl p-3 text-left sm:min-w-44">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">Skyline ID</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="truncate font-mono text-sm font-semibold tracking-wider">
                  {showId ? member?.memberId ?? "—" : "••••••••••••"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl"
                  aria-label={showId ? "Hide member ID" : "Show member ID"}
                  onClick={() => setShowId((value) => !value)}
                >
                  {showId ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Trophy />} label="Current rank" value={member?.level?.name ?? "Unranked"} className="sm:col-span-2" />
        <Stat icon={<Sparkles />} label="Account" value={trainingOnly ? "Training only" : "Training + working"} />
      </div>

      <div className="mt-6">
        {trainingOnly ? (
          <div className="raised-panel metal-edge rounded-3xl p-6 text-center">
            <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 font-display text-base font-semibold">Working section locked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account is set to training only. Complete your training — your admin will unlock
              working, earnings and team when you are ready.
            </p>
          </div>
        ) : (
          <EarningsPanel />
        )}
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

/**
 * Signed in, but this account is not an active member: no member menu here.
 * Trainees are sent to their own dashboard, unknown accounts back to the landing page.
 */
function NoMemberAccess({ hasProfile }: { hasProfile: boolean }) {
  const navigate = useNavigate();
  const resolveRole = useServerFn(getSessionRole);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hasProfile) return;
    let active = true;
    void resolveRole()
      .catch(() => null)
      .then(async (role) => {
        if (!active) return;
        if (role?.role === "trainee") {
          await navigate({ to: "/beginners", replace: true });
          return;
        }
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        await navigate({ to: "/", replace: true });
      });
    return () => {
      active = false;
    };
  }, [hasProfile, navigate, queryClient, resolveRole]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
  }

  if (!hasProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="raised-panel w-full max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-lg font-semibold">Your membership is not active</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please contact your {BRAND.name} administrator.
        </p>
        <Button className="mt-6 w-full" onClick={() => void signOut()}>
          Back to home
        </Button>
      </div>
    </main>
  );
}
