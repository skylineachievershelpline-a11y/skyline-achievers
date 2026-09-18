import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import {
  dismissNotification,
  getNotifications,
  markNotificationsRead,
} from "@/lib/member.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkylineLoader } from "@/components/brand/SkylineLoader";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Announcements — Skyline Achievers" },
      {
        name: "description",
        content: "Platform announcements and new lecture alerts for Skyline Achievers members.",
      },
      { property: "og:title", content: "Announcements — Skyline Achievers" },
      { property: "og:description", content: "Stay updated with Skyline Achievers announcements." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const dismiss = useServerFn(dismissNotification);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => load(),
    enabled: ready,
  });

  const remove = useMutation({
    mutationFn: (id: string) => dismiss({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Notification deleted");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const unread = (data?.items ?? []).filter((n: any) => !n.is_read).map((n: any) => n.id);
    if (unread.length === 0) return;
    void markRead({ data: { ids: unread } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [data, markRead, queryClient]);

  return (
    <MemberShell title="Announcements" subtitle="Updates from your administrators">
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <SkylineLoader />
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <ul className="space-y-2">
          {data!.items.map((item: any) => (
            <li
              key={item.id}
              className={cn(
                "glass-panel rounded-2xl p-4",
                !item.is_read && "border-brand/40 shadow-[var(--shadow-brand)]",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-glass text-brand-glow">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(item.created_at)}
                  </p>
                  {item.link_path?.startsWith("/lecture/") ? (
                    <Link
                      to="/lecture/$lectureId"
                      params={{ lectureId: item.link_path.replace("/lecture/", "") }}
                      className="mt-2 inline-block text-xs font-medium text-brand-glow"
                    >
                      Open lecture →
                    </Link>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </MemberShell>
  );
}
