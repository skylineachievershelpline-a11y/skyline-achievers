import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROOF_BUCKET = "payment-proofs";
const uuid = z.string().uuid();

type Identity = {
  id: string;
  kind: "member" | "trainee";
  name: string;
  code: string | null;
  phone: string | null;
};

/** Works for both the upline (member) and the Beginners Training (trainee) account. */
async function loadIdentity(userId: string): Promise<Identity | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: member } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, phone, status")
    .eq("id", userId)
    .maybeSingle();
  if (member && member.status === "active") {
    return {
      id: member.id,
      kind: "member",
      name: member.full_name,
      code: member.member_id,
      phone: member.phone ?? null,
    };
  }
  const { data: trainee } = await supabaseAdmin
    .from("trainees")
    .select("id, trainee_code, full_name, phone, status")
    .eq("id", userId)
    .maybeSingle();
  if (trainee && trainee.status === "active") {
    return {
      id: trainee.id,
      kind: "trainee",
      name: trainee.full_name,
      code: trainee.trainee_code,
      phone: trainee.phone ?? null,
    };
  }
  return null;
}

/** Every published paid course plus this account's request status for each. */
export const getCourseCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const identity = await loadIdentity(context.userId);
    if (!identity) return { courses: [], identity: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signThumbnails } = await import("./storage.server");

    const [{ data: courses }, { data: mine }] = await Promise.all([
      supabaseAdmin
        .from("paid_courses")
        .select(
          "id, title, tagline, description, price_pkr, old_price_pkr, highlights, thumbnail_path, duration_label, sort_order",
        )
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at"),
      supabaseAdmin
        .from("course_enrollments")
        .select("course_id, status, created_at, admin_note")
        .eq("buyer_id", identity.id),
    ]);

    const statuses = new Map((mine ?? []).map((row) => [row.course_id, row]));
    const withThumbs = await signThumbnails(courses ?? []);
    const { data: lessonCounts } = await supabaseAdmin
      .from("paid_course_lessons")
      .select("course_id")
      .eq("is_published", true);
    const counts = new Map<string, number>();
    for (const row of lessonCounts ?? []) {
      counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
    }

    return {
      identity: { name: identity.name, code: identity.code, kind: identity.kind },
      courses: withThumbs.map((course) => {
        const record = statuses.get(course.id);
        return {
          ...course,
          lessons: counts.get(course.id) ?? 0,
          access: (record?.status ?? "none") as "none" | "pending" | "approved" | "rejected",
          adminNote: record?.admin_note ?? null,
        };
      }),
    };
  });

/** One course: lessons unlock only after the admin approves the payment. */
export const getCourseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) => z.object({ courseId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const identity = await loadIdentity(context.userId);
    if (!identity) return { status: "no_account" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, signThumbnails, VIDEO_BUCKET } = await import("./storage.server");

    const { data: course } = await supabaseAdmin
      .from("paid_courses")
      .select(
        "id, title, tagline, description, price_pkr, old_price_pkr, highlights, thumbnail_path, duration_label, is_published",
      )
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || !course.is_published) return { status: "not_found" as const };

    const [{ data: enrollment }, { data: methods }, { data: settings }, { data: lessons }] =
      await Promise.all([
        supabaseAdmin
          .from("course_enrollments")
          .select("id, status, admin_note, created_at, reviewed_at, amount_pkr, method_label, reference")
          .eq("course_id", course.id)
          .eq("buyer_id", identity.id)
          .maybeSingle(),
        supabaseAdmin
          .from("course_payment_methods")
          .select("id, label, account_name, account_number, instructions")
          .eq("is_active", true)
          .order("sort_order"),
        supabaseAdmin
          .from("course_payment_settings")
          .select("intro, steps, support_contact, turnaround_note")
          .eq("id", "main")
          .maybeSingle(),
        supabaseAdmin
          .from("paid_course_lessons")
          .select(
            "id, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, duration_seconds, is_preview, sort_order",
          )
          .eq("course_id", course.id)
          .eq("is_published", true)
          .order("sort_order")
          .order("created_at"),
      ]);

    const unlocked = enrollment?.status === "approved";
    const withThumbs = await signThumbnails(lessons ?? []);
    const playable = await Promise.all(
      withThumbs.map(async (lesson) => {
        const allowed = unlocked || lesson.is_preview;
        const url = allowed
          ? lesson.video_source === "url"
            ? lesson.video_url
            : await signPath(VIDEO_BUCKET, lesson.video_path, 60 * 60 * 3)
          : null;
        return {
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          aspectRatio: lesson.aspect_ratio,
          durationSeconds: lesson.duration_seconds,
          isPreview: lesson.is_preview,
          thumbnailUrl: lesson.thumbnail_url,
          url,
          locked: !allowed,
        };
      }),
    );

    const [{ thumbnail_url: coverUrl }] = await signThumbnails([course]);

    return {
      status: "ok" as const,
      identity: { name: identity.name, code: identity.code, phone: identity.phone },
      course: { ...course, coverUrl },
      unlocked,
      enrollment: enrollment ?? null,
      methods: methods ?? [],
      settings: settings ?? null,
      lessons: playable,
    };
  });

/** Short lived upload slot for the payment screenshot. */
export const createProofUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileName: string }) =>
    z.object({ fileName: z.string().trim().min(1).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const identity = await loadIdentity(context.userId);
    if (!identity) throw new Error("This account cannot upload payment proof.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dot = data.fileName.lastIndexOf(".");
    const ext = dot > 0 ? data.fileName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase() : "jpg";
    const path = `${identity.id}/${crypto.randomUUID()}.${ext.slice(0, 6) || "jpg"}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Submit (or resubmit) the payment for review. */
export const submitCoursePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      courseId: string;
      phone: string;
      methodLabel: string;
      amount: number;
      reference: string;
      proofPath: string;
      note?: string | null;
    }) =>
      z
        .object({
          courseId: uuid,
          phone: z.string().trim().min(7, "Enter your WhatsApp number").max(20),
          methodLabel: z.string().trim().min(1, "Choose the payment method").max(80),
          amount: z.number().min(1, "Enter the amount you sent"),
          reference: z.string().trim().min(3, "Enter the transaction ID").max(120),
          proofPath: z.string().trim().min(3, "Upload the payment screenshot").max(400),
          note: z.string().trim().max(500).optional().nullable(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const identity = await loadIdentity(context.userId);
    if (!identity) return { ok: false as const, reason: "no_account" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabaseAdmin
      .from("paid_courses")
      .select("id, title, is_published")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course || !course.is_published) return { ok: false as const, reason: "not_found" as const };

    const { data: existing } = await supabaseAdmin
      .from("course_enrollments")
      .select("id, status")
      .eq("course_id", course.id)
      .eq("buyer_id", identity.id)
      .maybeSingle();
    if (existing?.status === "approved") return { ok: true as const, alreadyApproved: true };

    const payload = {
      course_id: course.id,
      buyer_id: identity.id,
      buyer_kind: identity.kind,
      buyer_name: identity.name,
      buyer_code: identity.code,
      phone: data.phone,
      method_label: data.methodLabel,
      amount_pkr: data.amount,
      reference: data.reference,
      proof_path: data.proofPath,
      note: data.note ?? null,
      status: "pending",
      admin_note: null,
      reviewed_at: null,
    };

    if (existing) {
      await supabaseAdmin.from("course_enrollments").update(payload).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("course_enrollments").insert(payload);
    }
    return { ok: true as const, alreadyApproved: false };
  });
