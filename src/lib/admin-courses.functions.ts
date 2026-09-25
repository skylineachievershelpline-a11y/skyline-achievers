import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();
const PROOF_BUCKET = "payment-proofs";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

async function admin() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Everything the Paid Courses tab needs in one call. */
export const adminGetCourseData = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { signThumbnails } = await import("./storage.server");

  const [{ data: courses }, { data: lessons }, { data: methods }, { data: settings }, { data: requests }] =
    await Promise.all([
      db
        .from("paid_courses")
        .select("*")
        .order("sort_order")
        .order("created_at"),
      db.from("paid_course_lessons").select("*").order("sort_order").order("created_at"),
      db.from("course_payment_methods").select("*").order("sort_order").order("created_at"),
      db.from("course_payment_settings").select("*").eq("id", "main").maybeSingle(),
      db
        .from("course_enrollments")
        .select("*, paid_courses:course_id (title)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  return {
    courses: await signThumbnails(courses ?? []),
    lessons: lessons ?? [],
    methods: methods ?? [],
    settings: settings ?? null,
    requests: requests ?? [],
  };
});

export const adminSaveCourse = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid.optional().nullable(),
        title: z.string().trim().min(2).max(140),
        tagline: optional(200),
        description: optional(4000),
        pricePkr: z.number().min(0),
        oldPricePkr: z.number().min(0).optional().nullable(),
        highlights: z.array(z.string().trim().max(160)).max(12).optional(),
        thumbnailPath: optional(400),
        durationLabel: optional(80),
        isPublished: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const row: Record<string, unknown> = {
      title: data.title,
      tagline: data.tagline,
      description: data.description,
      price_pkr: data.pricePkr,
      old_price_pkr: data.oldPricePkr ?? null,
      highlights: (data.highlights ?? []).filter(Boolean),
      duration_label: data.durationLabel,
      is_published: data.isPublished,
      sort_order: data.sortOrder,
    };
    if (data.thumbnailPath) row['thumbnail_path'] = data.thumbnailPath;
    if (data.id) await db.from("paid_courses").update(row as never).eq("id", data.id);
    else await db.from("paid_courses").insert(row as never);
    return { ok: true as const };
  });

export const adminDeleteCourse = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("paid_courses").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSaveCourseLesson = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid.optional().nullable(),
        courseId: uuid,
        title: z.string().trim().min(2).max(160),
        description: optional(2000),
        videoSource: z.enum(["upload", "url"]),
        videoPath: optional(400),
        videoUrl: optional(600),
        thumbnailPath: optional(400),
        aspectRatio: z.enum(["16/9", "9/16", "1/1", "4/3"]),
        isPreview: z.boolean(),
        isPublished: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const row: Record<string, unknown> = {
      course_id: data.courseId,
      title: data.title,
      description: data.description,
      video_source: data.videoSource,
      aspect_ratio: data.aspectRatio,
      is_preview: data.isPreview,
      is_published: data.isPublished,
      sort_order: data.sortOrder,
      video_url: data.videoSource === "url" ? data.videoUrl : null,
    };
    if (data.videoSource === "upload" && data.videoPath) row['video_path'] = data.videoPath;
    if (data.thumbnailPath) row['thumbnail_path'] = data.thumbnailPath;
    if (data.id) await db.from("paid_course_lessons").update(row as never).eq("id", data.id);
    else await db.from("paid_course_lessons").insert(row as never);
    return { ok: true as const };
  });

export const adminDeleteCourseLesson = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("paid_course_lessons").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSavePaymentMethod = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: uuid.optional().nullable(),
        label: z.string().trim().min(2).max(80),
        accountName: optional(120),
        accountNumber: optional(120),
        instructions: optional(600),
        qrUrl: optional(500),
        isActive: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const row = {
      label: data.label,
      account_name: data.accountName,
      account_number: data.accountNumber,
      instructions: data.instructions,
      qr_url: data.qrUrl ?? null,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };

    if (data.id) await db.from("course_payment_methods").update(row as never).eq("id", data.id);
    else await db.from("course_payment_methods").insert(row as never);
    return { ok: true as const };
  });

export const adminDeletePaymentMethod = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("course_payment_methods").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const adminSaveCoursePaymentSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        intro: optional(1200),
        steps: optional(2000),
        supportContact: optional(160),
        turnaroundNote: optional(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("course_payment_settings").upsert({
      id: "main",
      intro: data.intro,
      steps: data.steps,
      support_contact: data.supportContact,
      turnaround_note: data.turnaroundNote,
      updated_at: new Date().toISOString(),
    } as never);
    return { ok: true as const };
  });

/** Approve or reject a payment request. Approving unlocks the course instantly. */
export const adminDecideEnrollment = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "approved" | "rejected" | "pending"; adminNote?: string | null }) =>
    z
      .object({
        id: uuid,
        status: z.enum(["approved", "rejected", "pending"]),
        adminNote: optional(400),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await db
      .from("course_enrollments")
      .update({
        status: data.status,
        admin_note: data.adminNote,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true as const };
  });

export const adminDeleteEnrollment = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("course_enrollments").delete().eq("id", data.id);
    return { ok: true as const };
  });

/** Give course access directly, without a payment screenshot. */
export const adminGrantCourseAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { courseId: string; code: string }) =>
    z.object({ courseId: uuid, code: z.string().trim().min(3).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const code = data.code.trim();

    const { data: member } = await db
      .from("member_profiles")
      .select("id, member_id, full_name, phone")
      .eq("member_id", code)
      .maybeSingle();
    const { data: trainee } = member
      ? { data: null }
      : await db
          .from("trainees")
          .select("id, trainee_code, full_name, phone")
          .eq("trainee_code", code)
          .maybeSingle();

    const person = member
      ? { id: member.id, kind: "member", name: member.full_name, code: member.member_id, phone: member.phone }
      : trainee
        ? { id: trainee.id, kind: "trainee", name: trainee.full_name, code: trainee.trainee_code, phone: trainee.phone }
        : null;
    if (!person) return { ok: false as const, reason: "not_found" as const };

    await db.from("course_enrollments").upsert(
      {
        course_id: data.courseId,
        buyer_id: person.id,
        buyer_kind: person.kind,
        buyer_name: person.name,
        buyer_code: person.code,
        phone: person.phone,
        method_label: "Granted by admin",
        status: "approved",
        reviewed_at: new Date().toISOString(),
      } as never,
      { onConflict: "course_id,buyer_id" },
    );
    return { ok: true as const, name: person.name };
  });

/** Short lived link so the admin can view the uploaded screenshot. */
export const adminSignPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string().trim().min(3).max(400) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: signed } = await db.storage.from(PROOF_BUCKET).createSignedUrl(data.path, 60 * 30);
    return { url: signed?.signedUrl ?? null };
  });
