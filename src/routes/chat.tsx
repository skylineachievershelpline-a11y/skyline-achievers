import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Messages — Skyline Achievers" },
      {
        name: "description",
        content:
          "Private messages between Skyline Achievers trainees and their trainer: text, photos, videos and files.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Messages — Skyline Achievers" },
      {
        property: "og:description",
        content: "Chat privately with your trainer or your trainees inside Skyline Achievers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) void navigate({ to: "/" });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) void navigate({ to: "/" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="infographic-grid relative min-h-screen pb-14">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />
      <main className="relative mx-auto max-w-5xl px-4 py-5">
        <header className="mb-5 flex items-center gap-3">
          <Link to="/dashboard" aria-label="Back to dashboard">
            <Button variant="outline" size="icon" className="rounded-2xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <BrandLogo size="sm" withWordmark={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Skyline Achievers
            </p>
            <h1 className="font-display text-lg font-semibold tracking-tight">Messages</h1>
          </div>
        </header>

        <ChatWorkspace />
      </main>
    </div>
  );
}
