import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { formatDateTime12 as formatDateTime } from "@/lib/format";
import { getSharedTraineeReport } from "@/lib/journey.functions";

export const Route = createFileRoute("/report/$token")({
  head: () => ({
    meta: [
      { title: "Training progress report | Skyline Achievers" },
      {
        name: "description",
        content:
          "A private, read-only training progress record shared by a Skyline Achievers upline: session timings, review submissions and interview result.",
      },
      { property: "og:title", content: "Training progress report | Skyline Achievers" },
      {
        property: "og:description",
        content: "Private read-only training progress record shared by a Skyline Achievers upline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedReportPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SharedReportPage() {
  const { token } = Route.useParams();
  const read = useServerFn(getSharedTraineeReport);
  const report = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => read({ data: { token } } as never) as never,
  });

  const data = report.data as Awaited<ReturnType<typeof getSharedTraineeReport>> | undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <BrandLogo className="mx-auto" />
      <h1 className="mt-5 text-center font-display text-xl font-bold">Training progress report</h1>

      {report.isLoading ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">Loading the record…</p>
      ) : !data || data.status !== "ok" ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          This report link is closed or not valid any more. Please ask the upline for a new link.
        </p>
      ) : (
        <>
          <section className="raised-panel mt-5 rounded-3xl p-5">
            <p className="font-display text-lg font-semibold">{data.trainee.name}</p>
            <p className="text-xs text-primary">{data.trainee.code}</p>
            <div className="mt-3">
              <Row label="Status" value={data.trainee.status} />
              <Row label="Joined" value={formatDateTime(data.trainee.joinedAt)} />
              <Row
                label="Upline"
                value={data.upline ? `${data.upline.name} · ${data.upline.code}` : "—"}
              />
              <Row label="Stage" value={data.stage} />
              <Row label="Final interview" value={data.interviewResult ?? "not taken yet"} />
              {data.interviewNote ? <Row label="Interview note" value={data.interviewNote} /> : null}
              <Row
                label="Personal Mentorship verified"
                value={`${data.wallet.verified} / ${data.wallet.required}`}
              />
              <Row label="2CC verified" value={`${data.wallet.ccVerified} / ${data.wallet.ccTarget}`} />
            </div>
          </section>

          <section className="glass-panel mt-4 space-y-3 rounded-3xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Sessions, timings and reviews
            </p>
            {data.sessions.map((session) => (
              <div key={session.sessionNumber} className="inset-panel rounded-2xl p-3">
                <p className="text-sm font-semibold">
                  Session {String(session.sessionNumber).padStart(2, "0")} — {session.title}
                </p>
                <div className="mt-2">
                  <Row
                    label="Scheduled"
                    value={session.scheduledAt ? formatDateTime(session.scheduledAt) : "not set"}
                  />
                  <Row
                    label="Joined"
                    value={
                      session.openedAt
                        ? `${formatDateTime(session.openedAt)}${
                            session.joinLateMinutes && session.joinLateMinutes > 0
                              ? ` · ${session.joinLateMinutes} min late`
                              : " · on time"
                          }`
                        : "not joined"
                    }
                  />
                  <Row
                    label="Review sent"
                    value={
                      session.submittedAt
                        ? `${formatDateTime(session.submittedAt)}${session.late ? " · late" : " · in time"}`
                        : "not sent"
                    }
                  />
                  <Row label="Decision" value={session.review} />
                  {session.reviewedAt ? (
                    <Row label="Decided on" value={formatDateTime(session.reviewedAt)} />
                  ) : null}
                  {session.uplineNote ? <Row label="Upline note" value={session.uplineNote} /> : null}
                </div>
                {session.reviewBody ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-2 text-[11px] text-muted-foreground">
                    {session.reviewBody}
                  </p>
                ) : null}
              </div>
            ))}
          </section>

          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            Read-only training record. No personal contact details are shared.
          </p>
        </>
      )}
    </main>
  );
}
