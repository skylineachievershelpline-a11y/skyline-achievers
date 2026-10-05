import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Copy, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { getFboPublicPayment } from "@/lib/fbo-payment.functions";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackButton } from "@/components/member/BackButton";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { getLandingIntroduction } from "@/lib/landing.functions";

export const Route = createFileRoute("/enrollment-video")({
  validateSearch: (search) => {
    const raw = (search as Record<string, unknown>).fbo;
    return { fbo: raw === undefined || raw === null ? undefined : String(raw) };
  },
  loaderDeps: ({ search }) => ({ fbo: search.fbo }),
  loader: async ({ deps }) => {
    const [intro, payment] = await Promise.all([
      getLandingIntroduction(),
      deps.fbo && /^\d{12}$/.test(deps.fbo)
        ? getFboPublicPayment({ data: { fbo: deps.fbo } })
        : Promise.resolve({ method: null, fullName: null }),
    ]);
    return { ...intro, payment };
  },
  head: ({ loaderData }) => {
    const video = loaderData?.introduction;
    const title = video?.title
      ? `${video.title} — Skyline Achievers`
      : "Enrollment Video — Skyline Achievers";
    const description =
      video?.description ?? "Watch the Skyline Achievers enrollment and working overview video.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(video?.thumbnailUrl
          ? [
              { property: "og:image", content: video.thumbnailUrl },
              { name: "twitter:image", content: video.thumbnailUrl },
            ]
          : []),
      ],
    };
  },
  component: EnrollmentVideoPage,
});

function EnrollmentVideoPage() {
  const { introduction, payment } = Route.useLoaderData();
  const [open, setOpen] = useState(false);

  return (
    <main className="infographic-grid relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3 animate-rise-in">
          <BackButton fallback="/" className="h-10 w-10 rounded-2xl" />
          <BrandLogo size="sm" withWordmark={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Enrollment Video
            </p>
            <h1 className="font-display text-lg font-semibold">
              {introduction?.title ?? "Skyline Achievers"}
            </h1>
          </div>
        </header>

        {introduction?.videoUrl ? (
          <div className="animate-rise-in space-y-5">
            <div className="raised-panel overflow-hidden rounded-3xl p-3 sm:p-4">
              <SessionVideo
                title={introduction.title}
                videoUrl={introduction.videoUrl}
                aspectRatio={introduction.aspectRatio}
                poster={introduction.thumbnailUrl}
              />
            </div>
            <section className="glass-panel metal-edge rounded-3xl p-6">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Working Overview
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold">{introduction.title}</h2>
              {introduction.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {introduction.description}
                </p>
              ) : null}
            </section>
            <Button
              variant="outline"
              className="w-full rounded-2xl"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "See Less" : "See More"}
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
            {open ? (
              <div className="animate-rise-in space-y-5">
                {payment?.method ? (
                  <section className="glass-panel metal-edge rounded-3xl p-6">
                    <div className="flex items-center gap-2 text-brand-glow">
                      <Wallet className="h-5 w-5" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                        Payment Method
                      </p>
                    </div>
                    <h2 className="mt-2 font-display text-xl font-semibold">{payment.method.provider}</h2>
                    {payment.fullName ? (
                      <p className="text-xs text-muted-foreground">Shared by {payment.fullName}</p>
                    ) : null}
                    {[
                      ["Account title", payment.method.accountTitle],
                      ["Account number", payment.method.accountNumber],
                    ].map(([label, value]) => (
                      <div key={label} className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                          <p className="break-all font-semibold">{value}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Copy ${label}`}
                          onClick={() => {
                            void navigator.clipboard.writeText(value ?? "");
                            toast.success("Copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {payment.method.note ? (
                      <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{payment.method.note}</p>
                    ) : null}
                  </section>
                ) : (
                  <p className="rounded-2xl border border-hairline bg-surface p-4 text-sm text-muted-foreground">
                    Please ask the person who shared this video for payment details.
                  </p>
                )}
                <div className="-mx-4 sm:-mx-8">
                  <ReviewsSection />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <section className="raised-panel rounded-3xl p-8 text-center">
            <h1 className="font-display text-lg font-semibold">Enrollment video is unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please check again later.</p>
          </section>
        )}
      </div>
    </main>
  );
}