import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Eye, EyeOff, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { AnnouncementBanner } from "@/components/member/AnnouncementBanner";
import { AvatarPicker } from "@/components/member/AvatarPicker";
import { LectureCard, Rail } from "@/components/member/cards";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { DailyReportPanel } from "@/components/member/DailyReportPanel";
import { formatRankName, RankPin } from "@/components/member/RankPin";
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
import { fastSignOut } from "@/lib/sign-out";
import { toast } from "sonner";

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
  const [idCopied, setIdCopied] = useState(false);
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
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

      <section className="mx-auto w-full max-w-3xl space-y-6 px-1 py-3 font-achiever animate-rise-in sm:px-4">
        <div className="flex items-start gap-5 sm:gap-7">
          <div className="shrink-0">
            <AvatarPicker
              name={member?.fullName ?? "Member"}
              url={member?.avatarUrl ?? null}
              label=""
              hint=""
            />
          </div>
          <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-1.5">
                <h1 className="min-w-0 break-words font-display text-xl font-bold leading-tight sm:text-2xl">
                 {member?.fullName ?? "Member"}
               </h1>
                 <RankPin rank={member?.level?.name} className="h-12 w-12" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-5 sm:max-w-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="truncate font-achiever-display text-sm font-bold text-cyan sm:text-base">
                  {showId ? member?.memberId ?? "—" : "••••••••••••"}
                  </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                    className="h-7 w-7 shrink-0 rounded-full"
                  aria-label={showId ? "Hide member ID" : "Show member ID"}
                  onClick={() => setShowId((value) => !value)}
                >
                  {showId ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-full"
                    aria-label="Copy member ID"
                    onClick={() => {
                      const memberId = member?.memberId;
                      if (!memberId) return;
                      void navigator.clipboard.writeText(memberId).then(() => {
                        setIdCopied(true);
                        toast.success("Member ID copied");
                        window.setTimeout(() => setIdCopied(false), 1800);
                      }).catch(() => toast.error("Could not copy the Member ID"));
                    }}
                  >
                    {idCopied ? <Check /> : <Copy />}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Member ID</p>
              </div>
              <div className="min-w-0">
                <p className="break-words font-achiever-display text-sm font-bold leading-snug sm:text-base">{formatRankName(member?.level?.name)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Level</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-cyan">Skyline Achiever</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {member?.bio || "Learning today. Earning with purpose. Leading by example."}
          </p>
          <p className="pt-1 text-xs font-semibold text-cyan">{BRAND.name} • {BRAND.tagline}</p>
        </div>

      </section>

      <div className="mx-auto mt-6 w-full max-w-3xl"><DailyInspiration /></div>

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
          <DailyReportPanel />
        )}
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
    fastSignOut((path) => void navigate({ to: path, replace: true }));
  }

  if (!hasProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
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
