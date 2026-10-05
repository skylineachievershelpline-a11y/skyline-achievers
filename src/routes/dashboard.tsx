import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Eye, EyeOff, ListChecks, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { AnnouncementBanner } from "@/components/member/AnnouncementBanner";
import { FounderTrainingBar } from "@/components/founder/FounderTrainingBar";
import { FlyingSkylineAiMascot } from "@/components/ai/SkylineAiMascot";
import { UplineRequestsPanel } from "@/components/journey/UplineRequestsPanel";

import { AvatarPicker } from "@/components/member/AvatarPicker";
import { LectureCard, Rail } from "@/components/member/cards";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { DailyReportPanel } from "@/components/member/DailyReportPanel";

import { formatRankName, RankPin } from "@/components/member/RankPin";
import { PushAlertsCard } from "@/components/member/PushAlertsCard";
import { PushWelcomeDialog } from "@/components/member/PushWelcomeDialog";
import { CcAmountCard, MentorshipFeeCard } from "@/components/member/MentorshipPanel";
import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
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
import { getAccessToken } from "@/lib/session-token";
import { fastSignOut } from "@/lib/sign-out";

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
  const [mentorshipSlip, setMentorshipSlip] = useState<PaymentSlipData | null>(null);
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
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
  const progress = data.progress ?? null;
  const isFbo = Number(member?.level?.rank_order ?? 0) >= 2;
  const isFounder = member?.memberId === "760000010005";
  const openMentorshipReceipt = () => {
    if (!member || !progress || progress.feePaid <= 0) return;
    setMentorshipSlip({
      kind: "mentorship",
      title: "Personal Mentorship Amount",
      buyerName: member.fullName,
      buyerId: member.memberId,
      rank: member.level?.name ?? null,
      amount: progress.feePaid,
      totalAmount: progress.feeTotal,
      remainingAmount: progress.feeRemaining,
      status: progress.feeComplete ? "Amount complete" : "Part payment received",
      note: progress.feeComplete
        ? "Training unlocks after admin verification. Keep this receipt for your record."
        : "Remaining amount must be completed before the deadline.",
      submittedAt: new Date(),
    });
  };

  return (
    <MemberShell
      title={member?.fullName ?? "Member"}
      subtitle={isFounder ? "Founder & CEO · Skyline Achievers" : member?.level?.name ?? "Level not assigned"}
      executive
    >
      <AnnouncementBanner />
      {isFounder ? <FounderTrainingBar /> : null}

      <div className="mx-auto mt-2 w-full max-w-3xl">
        <UplineRequestsPanel />
      </div>


      <section data-ai-guide="dashboard-profile" className="mx-auto w-full max-w-3xl space-y-6 px-1 py-3 font-achiever animate-rise-in sm:px-4">
        <div className="flex items-center gap-5 sm:gap-7">
          <div className="shrink-0">
            <AvatarPicker
              name={member?.fullName ?? "Member"}
              url={member?.avatarUrl ?? null}
              label=""
              hint=""
              editable={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mt-3 sm:max-w-md">
              <h1 className="font-display text-[clamp(1rem,5vw,1.5rem)] font-bold leading-tight break-words sm:text-2xl">
                {member?.fullName ?? "Member"}
                {!isFounder && (
                  <RankPin rank={member?.level?.name} className="ml-1 inline-block h-9 w-9 align-middle sm:h-11 sm:w-11" />
                )}
              </h1>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="whitespace-nowrap font-achiever-display text-[clamp(0.68rem,3vw,0.9rem)] font-bold text-cyan sm:text-base">
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
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{isFounder ? "Founder & CEO · Member ID" : "Member ID"}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-display text-sm font-bold sm:text-base">{isFounder ? "Founder & CEO" : formatRankName(member?.level?.name)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{isFounder ? "Skyline Achievers" : "Level"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-cyan">Skyline Achievers</p>
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {member?.bio || "Learning today. Earning with purpose. Leading by example."}
          </p>
          <p className="pt-1 text-xs font-semibold text-cyan">{BRAND.name} • {BRAND.tagline}</p>
        </div>

      </section>

      {/* Payment status is information only — it never locks the dashboard. */}
      {!isFbo && progress && !progress.feeComplete ? (
        <div className="mx-auto mt-2 w-full max-w-3xl">
          <MentorshipFeeCard
            progress={progress}
            onPrintReceipt={openMentorshipReceipt}
            ccTargets={data.ccTargets ?? null}
          />
        </div>
      ) : !isFbo && progress && data.ccMoney ? (
        <div className="mx-auto mt-2 w-full max-w-3xl">
          <CcAmountCard money={data.ccMoney} />
        </div>
      ) : null}


      <div data-ai-guide="todo-button" className="mx-auto mt-6 w-full max-w-3xl">
        <Button asChild variant="brand" size="xl" className="w-full justify-between rounded-2xl">
          <Link to="/todo">
            <span className="flex items-center gap-2"><ListChecks /> To-do List</span>
            <span className="text-xs opacity-80">View today's tasks</span>
          </Link>
        </Button>
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl">
        <PushWelcomeDialog />
        <PushAlertsCard />
      </div>

      <div className="mx-auto mt-6 w-full max-w-3xl"><DailyInspiration /></div>

      <div data-ai-guide="ai-button" className="relative mx-auto mt-4 w-full max-w-3xl py-4">
        <Button asChild variant="brand" size="xl" className="w-full justify-between rounded-2xl">
          <Link to="/ai"><span className="flex items-center gap-2"><Bot /> Skyline Achievers AI</span><span className="text-xs opacity-80">Ask for help</span></Link>
        </Button>
        <FlyingSkylineAiMascot />
      </div>

      <div data-ai-guide="daily-report" className="mt-6">
        {trainingOnly ? (
          <div className="raised-panel metal-edge rounded-3xl p-6 text-center">
            <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 font-display text-base font-semibold">Training first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Personal Mentorship accounts complete their training first. The daily working report,
              earnings and team open with the Assistant Supervisor upgrade.
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


      <PaymentSlip
        open={mentorshipSlip !== null}
        data={mentorshipSlip}
        onClose={() => setMentorshipSlip(null)}
      />
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
    void getAccessToken()
      .then((token) => (token ? resolveRole().catch(() => null) : null))
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
