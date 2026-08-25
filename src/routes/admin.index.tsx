import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LibraryTab } from "@/components/admin/LibraryTab";
import { MembersTab } from "@/components/admin/MembersTab";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminGetLibrary,
  adminGetStats,
  adminLogout,
  adminSendNotification,
  adminStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Skyline Achievers" },
      {
        name: "description",
        content: "Manage Skyline Achievers members, training library and announcements.",
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
    status.isError ||
    (status.isSuccess && !authed) ||
    stats.isError ||
    library.isError;

  useEffect(() => {
    if (!sessionLost) return;
    queryClient.removeQueries({ queryKey: ["admin-status"] });
    void navigate({ to: "/admin/login", replace: true });
  }, [sessionLost, queryClient, navigate]);

  if (sessionLost) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if (!authed || stats.isPending || library.isPending) {
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
            <div key={item.label} className="glass-panel rounded-3xl p-4">
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
            <TabsTrigger value="announcements" className="rounded-xl">
              Announcements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-5">
            <MembersTab levels={levels as any} />
          </TabsContent>
          <TabsContent value="library" className="mt-5">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="announcements" className="mt-5">
            <AnnouncementForm levels={levels} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function AnnouncementForm({ levels }: { levels: any[] }) {
  const send = useServerFn(adminSendNotification);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [levelId, setLevelId] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          title,
          body: body || null,
          kind: "announcement",
          audienceLevelId: levelId || null,
          linkPath: null,
        },
      } as never),
    onSuccess: () => {
      toast.success("Announcement sent");
      setTitle("");
      setBody("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="glass-panel-strong max-w-xl space-y-4 rounded-3xl p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ann-title">Title</Label>
        <Input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-2xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea
          id="ann-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-28 rounded-2xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ann-level">Audience</Label>
        <select
          id="ann-level"
          value={levelId}
          onChange={(e) => setLevelId(e.target.value)}
          className="h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm"
        >
          <option value="">All members</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="brand" size="xl" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        Send announcement
      </Button>
    </form>
  );
}
