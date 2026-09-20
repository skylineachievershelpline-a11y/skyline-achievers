import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut } from "lucide-react";
import { useEffect } from "react";

import { AnnouncementsTab } from "@/components/admin/AnnouncementsTab";
import { InspirationTab } from "@/components/admin/InspirationTab";
import { LibraryTab } from "@/components/admin/LibraryTab";
import { MembersTab } from "@/components/admin/MembersTab";
import { ReelsTab } from "@/components/admin/ReelsTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { ReviewsTab } from "@/components/admin/ReviewsTab";
import { SessionsTab } from "@/components/admin/SessionsTab";
import { StoriesTab } from "@/components/admin/StoriesTab";
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
        <SkylineLoader variant="page" />
      </div>
    );
  }

  const totals = stats.data?.totals;
  const levels = (library.data?.levels ?? []) as any[];

  return (
    <main className="motion-scope cinematic-shell infographic-grid relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="cinematic-ambient pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-6xl">
        <header className="cinematic-nav raised-panel mb-6 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5">
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
            { label: "Videos", value: totals?.lectures ?? 0 },
            { label: "Resources", value: totals?.resources ?? 0 },
          ].map((item) => (
            <div key={item.label} className="glass-panel metal-edge depth-hover relative overflow-hidden rounded-2xl p-4 animate-rise-in">
              <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </section>

        <Tabs defaultValue="members">
          <TabsList className="w-full rounded-xl">
            <TabsTrigger value="members" className="rounded-xl">
              Members
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-xl">
              Reports
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
            <TabsTrigger value="whatsapp" className="rounded-xl">
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="announcements" className="rounded-xl">
              Announcements
            </TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-xl">
              Landing
            </TabsTrigger>
            <TabsTrigger value="inspiration" className="rounded-xl">
              Daily Verses
            </TabsTrigger>
            <TabsTrigger value="stories" className="rounded-xl">
              Stories
            </TabsTrigger>
            <TabsTrigger value="courses" className="rounded-xl">
              Paid Courses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-5">
            <MembersTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="reports" className="mt-5">
            <ReportsTab />
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
          <TabsContent value="whatsapp" className="mt-5">
            <WhatsappTab />
          </TabsContent>
          <TabsContent value="announcements" className="mt-5">
            <AnnouncementsTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="reviews" className="mt-5">
            <ReviewsTab />
          </TabsContent>
          <TabsContent value="inspiration" className="mt-5">
            <InspirationTab />
          </TabsContent>
          <TabsContent value="stories" className="mt-5">
            <StoriesTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="courses" className="mt-5">
            <CoursesTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
