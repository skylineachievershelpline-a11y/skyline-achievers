import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { MentorshipPaymentSection } from "@/components/member/MentorshipPaymentSection";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pay-mentorship")({
  head: () => ({
    meta: [
      { title: "Complete Personal Mentorship Payment — Skyline Achievers" },
      {
        name: "description",
        content:
          "Pay your remaining Personal Mentorship amount: payment methods, screenshot upload, verification status and payment history.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Complete Personal Mentorship Payment — Skyline Achievers" },
      {
        property: "og:description",
        content: "Payment methods, screenshot upload and payment history in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PayMentorshipPage,
});

function PayMentorshipPage() {
  const ready = useMemberGuard();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  return (
    <MemberShell
      title="Personal Mentorship Payment"
      subtitle="Where to pay · how much is left · verification"
      executive
    >
      <div className="mx-auto w-full max-w-3xl px-1 py-3 font-achiever sm:px-4">
        <Button asChild variant="outline" className="mb-4 w-full rounded-2xl font-display sm:w-auto">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <MentorshipPaymentSection standalone />
      </div>
    </MemberShell>
  );
}
