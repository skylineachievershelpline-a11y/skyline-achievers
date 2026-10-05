import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AtmPaymentCard } from "@/components/payment/AtmPaymentCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { getFboPublicPayment } from "@/lib/fbo-payment.functions";

export const Route = createFileRoute("/pay/$fbo")({
  loader: ({ params }) => getFboPublicPayment({ data: { fbo: params.fbo } }),
  head: () => ({
    meta: [
      { title: "Payment Details — Skyline Achievers" },
      { name: "description", content: "View shared Skyline Achievers payment details." },
      { property: "og:title", content: "Payment Details — Skyline Achievers" },
      { property: "og:description", content: "View shared Skyline Achievers payment details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPaymentPage,
  errorComponent: () => <PaymentUnavailable />,
  notFoundComponent: () => <PaymentUnavailable />,
});

function PaymentUnavailable() {
  return (
    <main className="infographic-grid flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass-panel metal-edge w-full max-w-md rounded-3xl p-7 text-center">
        <Wallet className="mx-auto h-8 w-8 text-brand-glow" />
        <h1 className="mt-3 font-display text-xl font-semibold">Payment details unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please ask the FBO to share a new payment link.</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/">Back to home</Link></Button>
      </section>
    </main>
  );
}

function PublicPaymentPage() {
  const payment = Route.useLoaderData();
  if (!payment.methods.length) return <PaymentUnavailable />;

  const copyAll = async () => {
    const details = payment.methods
      .map((method) => `${method.provider}${method.bank ? ` · ${method.bank}` : ""}\nAccount Title: ${method.accountTitle}\nAccount Number: ${method.accountNumber}`)
      .join("\n\n");
    await navigator.clipboard.writeText(details);
    toast.success("Payment details copied");
  };

  return (
    <main className="infographic-grid relative min-h-screen px-4 py-8 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-xl space-y-5">
        <header className="flex items-center gap-3">
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Skyline Achievers</p>
            <h1 className="truncate font-display text-xl font-semibold">{payment.fullName ?? "FBO"} Payment Details</h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => void copyAll()}><Copy className="mr-1 h-4 w-4" /> Copy All</Button>
        </header>
        <div className="space-y-5">
          {payment.methods.map((method, index) => (
            <AtmPaymentCard key={`${method.provider}-${index}`} method={method} ownerName={payment.fullName} />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Tap Copy Number below any card to copy that account number.</p>
      </div>
    </main>
  );
}