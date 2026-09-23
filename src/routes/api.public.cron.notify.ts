import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Runs every 15 minutes. Sends the automatic phone alerts:
 * session start, review reminders, 8 PM FBO report reminders, motivational
 * quotes every 2 hours and 3 daily reels. Each alert is sent once per slot.
 */
export const Route = createFileRoute("/api/public/cron/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const result = await runNotifications();
        return Response.json(result);
      },
    },
  },
});

const PKT = 5 * 3_600_000;
const MIN15 = 15 * 60_000;

async function runNotifications() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { pushToUsers } = await import("@/lib/push.server");
  const { rollMissedSessions } = await import("@/lib/journey.server");
  const admin = supabaseAdmin as any;
  const now = Date.now();
  const pkt = new Date(now + PKT);
  const hour = pkt.getUTCHours();
  const minute = pkt.getUTCMinutes();
  const today = pkt.toISOString().slice(0, 10);
  const firstSlot = minute < 15;
  const stats: Record<string, number> = {};

  /** Records a key once; false when this alert already went out. */
  async function once(key: string) {
    const { error } = await admin.from("push_log").insert({ key });
    return !error;
  }
  const firstName = (name: string) => String(name ?? "").trim().split(/\s+/)[0] ?? "";

  // ---------- Trainees: session start + review reminders ----------
  const { data: trainees } = await admin
    .from("trainees")
    .select("id, full_name")
    .eq("status", "active");
  const traineeRows = (trainees ?? []) as any[];
  const traineeIds = traineeRows.map((row) => row.id);
  const [{ data: schedule }, { data: reviews }] = await Promise.all([
    admin
      .from("trainee_session_schedule")
      .select("trainee_id, session_number, scheduled_at")
      .in("trainee_id", traineeIds.length ? traineeIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("trainee_session_reviews")
      .select("trainee_id, session_number")
      .in("trainee_id", traineeIds.length ? traineeIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const reviewed = new Set(
    ((reviews ?? []) as any[]).map((row) => `${row.trainee_id}:${row.session_number}`),
  );
  const startedDay1 = new Set(
    ((reviews ?? []) as any[])
      .filter((row) => Number(row.session_number) === 1)
      .map((row) => row.trainee_id as string),
  );

  for (const trainee of traineeRows) {
    await rollMissedSessions(trainee.id, now);
  }
  const { data: freshSchedule } = await admin
    .from("trainee_session_schedule")
    .select("trainee_id, session_number, scheduled_at")
    .in("trainee_id", traineeIds.length ? traineeIds : ["00000000-0000-0000-0000-000000000000"])
    .order("session_number", { ascending: true });
  void schedule;

  const byTrainee = new Map<string, any[]>();
  for (const row of (freshSchedule ?? []) as any[]) {
    const list = byTrainee.get(row.trainee_id) ?? [];
    list.push(row);
    byTrainee.set(row.trainee_id, list);
  }

  for (const trainee of traineeRows) {
    const current = (byTrainee.get(trainee.id) ?? []).find(
      (row) => row.scheduled_at && !reviewed.has(`${trainee.id}:${row.session_number}`),
    );
    if (!current) continue;
    const start = new Date(current.scheduled_at).getTime();
    const code = String(current.session_number).padStart(2, "0");
    const name = firstName(trainee.full_name);

    if (now >= start && now < start + MIN15 * 2) {
      if (await once(`start:${trainee.id}:${current.session_number}:${current.scheduled_at}`)) {
        await pushToUsers([trainee.id], {
          title: `Session ${code} has started`,
          body: `${name}, your session is open now. Watch it and send your review.`,
          path: "/beginners",
          tag: `session-${trainee.id}`,
        });
        stats.sessionStart = (stats.sessionStart ?? 0) + 1;
      }
    } else if (now >= start + 3_600_000 && now < start + 3 * 3_600_000) {
      const slot = Math.floor(now / MIN15);
      if (await once(`review:${trainee.id}:${current.session_number}:${slot}`)) {
        await pushToUsers([trainee.id], {
          title: `Send your Session ${code} review`,
          body: `${name}, please submit your session review so your upline can approve it.`,
          path: "/beginners",
          tag: `review-reminder-${trainee.id}`,
        });
        stats.reviewReminder = (stats.reviewReminder ?? 0) + 1;
      }
    }
  }

  // ---------- Motivational quotes every 2 hours (8 AM – 10 PM PKT) ----------
  if (firstSlot && hour % 2 === 0 && hour >= 8 && hour <= 22 && (await once(`quote:${today}:${hour}`))) {
    const { data: quotes } = await admin
      .from("daily_inspirations")
      .select("text_en, text_ur, reference")
      .eq("is_active", true);
    const list = ((quotes ?? []) as any[]).filter((row) => row.text_en || row.text_ur);
    if (list.length > 0 && traineeIds.length > 0) {
      const pick = list[Math.floor(Math.random() * list.length)];
      await pushToUsers(traineeIds, {
        title: "Skyline Achievers motivation",
        body: String(pick.text_en || pick.text_ur).slice(0, 180),
        path: "/beginners",
        tag: "motivation",
      });
      stats.quotes = traineeIds.length;
    }
  }

  // ---------- Members ----------
  const { data: members } = await admin
    .from("member_profiles")
    .select("id, full_name, levels:level_id (rank_order)")
    .eq("status", "active");
  const memberRows = (members ?? []) as any[];

  // 8 PM – midnight PKT: FBO (Assistant Supervisor and above) report reminder every 15 min.
  if (hour >= 20) {
    const fbos = memberRows.filter((row) => Number(row.levels?.rank_order ?? 0) >= 2);
    const { data: reports } = await admin
      .from("member_daily_reports")
      .select("member_id, submitted_at")
      .eq("report_date", today);
    const done = new Set(
      ((reports ?? []) as any[]).filter((row) => row.submitted_at).map((row) => row.member_id),
    );
    const slot = Math.floor(now / MIN15);
    if (await once(`report:${today}:${slot}`)) {
      for (const member of fbos) {
        if (done.has(member.id)) continue;
        await pushToUsers([member.id], {
          title: "Daily report time",
          body: `${firstName(member.full_name)}, please submit today's working report.`,
          path: "/dashboard",
          tag: `report-${member.id}`,
        });
        stats.report = (stats.report ?? 0) + 1;
      }
    }
  }

  // Three reels a day: 11 AM, 3 PM, 7 PM PKT.
  if (firstSlot && [11, 15, 19].includes(hour) && (await once(`reel:${today}:${hour}`))) {
    const { data: reels } = await admin
      .from("reels")
      .select("id, title, caption")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = (reels ?? []) as any[];
    if (list.length > 0) {
      const reel = list[Math.floor(Math.random() * list.length)];
      const audience = [...memberRows.map((row) => row.id), ...startedDay1];
      await pushToUsers(audience, {
        title: `New reel: ${reel.title}`,
        body: reel.caption ? String(reel.caption).slice(0, 140) : "Tap to watch it now.",
        path: `/reels?reel=${reel.id}`,
        tag: "reel",
      });
      stats.reels = audience.length;
    }
  }

  // Keep the log small.
  await admin
    .from("push_log")
    .delete()
    .lt("created_at", new Date(now - 3 * 86_400_000).toISOString());

  return { ok: true, stats };
}
