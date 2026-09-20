import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Clock3, Crown, Lock, PlayCircle } from "lucide-react";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { getCourseCatalog } from "@/lib/courses.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Premium Courses — Skyline Achievers" },
      {
        name: "description",
        content:
          "Skyline Achievers premium paid courses: pay through the listed account, upload your payment screenshot and get access within 24 hours.",
      },
      { property: "og:title", content: "Premium Courses — Skyline Achievers" },
      {
        property: "og:description",
        content: "Unlock Skyline Achievers premium paid courses after payment verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursesPage,
});

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return `PKR ${Number(value).toLocaleString("en-PK")}`;
}

const ACCESS_BADGE: Record<string, { label: string; className: string; icon: typeof Lock }> = {
  none: { label: "Locked", className: "border-metal/30 text-muted-foreground", icon: Lock },
  pending: { label: "Under review", className: "border-amber-400/40 text-amber-300", icon: Clock3 },
  approved: { label: "Unlocked", className: "border-cyan/40 text-brand-glow", icon: BadgeCheck },
  rejected: { label: "Not verified", className: "border-red-400/40 text-red-300", icon: Lock },
};

function CoursesPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getCourseCatalog);
  const { data, isPending } = useQuery({
    queryKey: ["course-catalog"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (!ready || isPending) {
    return (
      <MemberShell title="Premium Courses" executive>
        <SkylineLoader label="Loading premium courses" />
      </MemberShell>
    );
  }

  const courses = data?.courses ?? [];

  return (
    <MemberShell title="Premium Courses" subtitle="Paid programs • access after verification" executive>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <section className="raised-panel relative overflow-hidden rounded-[28px] p-6">
          <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/15 text-brand-glow shadow-brand">
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold">Premium Paid Courses</h1>
              <p className="text-xs text-muted-foreground">
                Send the fee and upload your payment screenshot. Access is provided within 24 hours
                after verification.
              </p>
            </div>
          </div>
        </section>

        {courses.length === 0 ? (
          <EmptyState
            title="No premium course yet"
            hint="Published premium courses will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => {
              const badge = ACCESS_BADGE[course.access] ?? ACCESS_BADGE['none']!;
              return (
                <Link
                  key={course.id}
                  to="/course/$courseId"
                  params={{ courseId: course.id }}
                  className="group raised-panel relative flex flex-col overflow-hidden rounded-[26px] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-brand-glow">
                        <PlayCircle className="h-10 w-10" />
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur",
                        badge.className,
                      )}
                    >
                      <badge.icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="font-display text-sm font-semibold">{course.title}</p>
                    {course.tagline ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{course.tagline}</p>
                    ) : null}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <div>
                        <p className="font-display text-base font-semibold text-brand-glow">
                          {money(course.price_pkr)}
                        </p>
                        {course.old_price_pkr ? (
                          <p className="text-[11px] text-muted-foreground line-through">
                            {money(course.old_price_pkr)}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {course.lessons} lesson{course.lessons === 1 ? "" : "s"}
                        {course.duration_label ? ` • ${course.duration_label}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </MemberShell>
  );
}
