import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut } from "lucide-react";
import { useEffect } from "react";

import { AnnouncementsTab } from "@/components/admin/AnnouncementsTab";
import { FinalTestTab } from "@/components/admin/FinalTestTab";
import { LiveTrainingTab } from "@/components/admin/LiveTrainingTab";
import { LibraryTab } from "@/components/admin/LibraryTab";
import { MembersTab } from "@/components/admin/MembersTab";
import { ReelsTab } from "@/components/admin/ReelsTab";
import { SessionsTab } from "@/components/admin/SessionsTab";
import { WhatsappTab } from "@/components/admin/WhatsappTab";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminGetLibrary, adminGetStats, adminLogout, adminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Skyline Achievers" },
      {
        name: "description",
        content: "Manage Skyline Achievers members, training library, reels and announcements.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Panel — Skyline Achievers" },
      { property: "og:description", content: "Restricted administrator workspace." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkStatus = useServerFn(adminStatus);
  const loadStats = useServerFn(adminGetStats);
  const loadLibrary = useServerFn(adminGetLibrary);
  const logout = useServerFn(adminLogout);

  const status = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => checkStatus(),
    retry: false,
  });
  const authed = status.data?.isAdmin === true;

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => loadStats(),
    enabled: authed,
    retry: false,
  });
  const library = useQuery({
    queryKey: ["admin-library"],
    queryFn: () => loadLibrary(),
    enabled: authed,
    retry: false,
  });

  // A stale/invalid admin cookie makes the server functions reject; treat that
  // as "session expired" instead of crashing the page.
  const sessionLost =
    status.isError || (status.isSuccess && !authed) || stats.isError || library.isError;

  useEffect(() => {
    if (!sessionLost) return;
    queryClient.removeQueries({ queryKey: ["admin-status"] });
    void navigate({ to: "/admin/login", replace: true });
  }, [sessionLost, queryClient, navigate]);

  if (sessionLost || !authed || stats.isPending || library.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const totals = stats.data?.totals;
  const levels = (library.data?.levels ?? []) as any[];

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" withWordmark={false} />
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">Admin panel</h1>
              <p className="text-[11px] text-muted-foreground">Skyline Achievers control room</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={async () => {
              await logout();
              queryClient.clear();
              await navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Members", value: totals?.members ?? 0 },
            { label: "Active", value: totals?.active ?? 0 },
            { label: "Series", value: totals?.series ?? 0 },
            { label: "Lectures", value: totals?.lectures ?? 0 },
          ].map((item) => (
            <div key={item.label} className="glass-panel rounded-3xl p-4 animate-rise-in">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </section>

        <Tabs defaultValue="members">
          <TabsList className="rounded-2xl">
            <TabsTrigger value="members" className="rounded-xl">
              Members
            </TabsTrigger>
            <TabsTrigger value="library" className="rounded-xl">
              Library
            </TabsTrigger>
            <TabsTrigger value="reels" className="rounded-xl">
              Reels
            </TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-xl">
              Sessions
            </TabsTrigger>
            <TabsTrigger value="live" className="rounded-xl">
              Live Training
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="rounded-xl">
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-xl">
              Announcements
            </TabsTrigger>
            <TabsTrigger value="finaltest" className="rounded-xl">
              Final Test
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-5">
            <MembersTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="library" className="mt-5">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="reels" className="mt-5">
            <ReelsTab />
          </TabsContent>
          <TabsContent value="sessions" className="mt-5">
            <SessionsTab />
          </TabsContent>
          <TabsContent value="live" className="mt-5">
            <LiveTrainingTab />
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-5">
            <WhatsappTab />
          </TabsContent>
          <TabsContent value="announcements" className="mt-5">
            <AnnouncementsTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="finaltest" className="mt-5">
            <FinalTestTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
