import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackButton } from "@/components/member/BackButton";
import { AtmPaymentCard } from "@/components/payment/AtmPaymentCard";
import { getFboPublicPayment } from "@/lib/fbo-payment.functions";

const EMPTY = { method: null, methods: [], fullName: null } as const;

/**
 * Standalone, shareable payment page. Anyone who receives the link sees the
 * FBO's payment cards — no account needed. Pressing back simply leaves the
 * page; it never becomes anyone's home screen.
 */
export const Route = createFileRoute("/pay/$fbo")({
  loader: ({ params }) => {
    const fbo = String(params.fbo ?? "").replace(/\D/g, "");
    if (!/^\d{12}$/.test(fbo)) return Promise.resolve(EMPTY);
    return getFboPublicPayment({ data: { fbo } }).catch(() => EMPTY);
  },
  head: ({ loaderData }) => {
    const name = loaderData?.fullName
      ? `${loaderData.fullName} — Payment Methods — Skyline Achievers`
      : "Payment Methods — Skyline Achievers";
    const description =
      "Payment methods shared through Skyline Achievers. No account needed to view.";
    return {
      meta: [
        { title: name },
        { name: "description", content: description },
        { property: "og:title", content: name },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: PayLinkPage,
});

function PayLinkPage() {
  const { methods, fullName } = Route.useLoaderData() as {
    methods: any[];
    fullName: string | null;
  };

  return (
    <main className="infographic-grid relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-xl space-y-5">
        <header className="flex items-center gap-3">
          <BackButton fallback="/" className="h-10 w-10 rounded-2xl" label="Close this page" />
          <BrandLogo size="sm" withWordmark={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Payment Methods
            </p>
            <h1 className="font-display text-lg font-semibold">
              {fullName ?? "Skyline Achievers"}
            </h1>
          </div>
        </header>

        {methods?.length ? (
          <div className="animate-rise-in space-y-4">
            {methods.map((method, i) => (
              <AtmPaymentCard key={i} method={method} ownerName={fullName} />
            ))}
          </div>
        ) : (
          <section className="raised-panel rounded-3xl p-8 text-center">
            <h2 className="font-display text-lg font-semibold">No payment methods shared yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please ask the person who shared this link for payment details.
            </p>
          </section>
        )}

        <p className="flex items-start gap-2 rounded-2xl border border-hairline bg-surface-2 p-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-glow" />
          This is a standalone payment link — it opens for anyone and pressing back simply closes
          the page. It never changes the app screen you normally open.
        </p>
      </div>
    </main>
  );
}
