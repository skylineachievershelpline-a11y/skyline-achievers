import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImageForUpload } from "@/components/admin/upload";
import { createExecutiveApplicationUploadUrl, getExecutiveApplication, submitExecutiveApplication } from "@/lib/growth-executive.functions";
import { putWithProgress } from "@/lib/upload-progress";

export const Route = createFileRoute("/apply/growth/$token")({
  head: () => ({ meta: [{ title: "Apply — Skyline Growth Executive" }, { name: "description", content: "Private Skyline Growth Executive application." }, { property: "og:title", content: "Apply — Skyline Growth Executive" }, { property: "og:description", content: "Private Growth Executive application for Skyline Achievers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: GrowthApplicationPage,
});

const blank = { fullName: "", phone: "", email: "", cnic: "", experience: "", qualification: "", city: "", requestedRole: "calling" as "calling" | "full_funnel", payoutMethod: "", payoutAccountTitle: "", payoutAccountNumber: "" };

function GrowthApplicationPage() {
  const { token } = Route.useParams(); const getInfo = useServerFn(getExecutiveApplication); const createUpload = useServerFn(createExecutiveApplicationUploadUrl); const submit = useServerFn(submitExecutiveApplication);
  const info = useQuery({ queryKey: ["growth-application", token], queryFn: () => getInfo({ data: { token } }), retry: false });
  const [form, setForm] = useState(blank); const [cnicFile, setCnicFile] = useState<File | null>(null); const [avatarFile, setAvatarFile] = useState<File | null>(null); const [progress, setProgress] = useState(0); const [done, setDone] = useState(false);
  async function upload(kind: "cnic" | "avatar", source: File) { const file = await compressImageForUpload(source, 650_000); const slot = await createUpload({ data: { token, kind, fileName: file.name } }); await putWithProgress(slot.signedUrl, file, setProgress); return slot.path; }
  const send = useMutation({ mutationFn: async () => { if (!cnicFile || !avatarFile) throw new Error("CNIC front and profile picture are required."); setProgress(1); const [cnicFrontPath, avatarPath] = await Promise.all([upload("cnic", cnicFile), upload("avatar", avatarFile)]); return submit({ data: { token, ...form, cnicFrontPath, avatarPath } }); }, onSuccess: () => setDone(true), onError: (e: Error) => alert(e.message) });
  if (info.isPending) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin" /></div>;
  if (info.error) return <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">{(info.error as Error).message}</div>;
  if (done) return <main className="grid min-h-screen place-items-center p-5"><div className="glass-panel max-w-md rounded-2xl p-8 text-center"><CheckCircle2 className="mx-auto size-12 text-success" /><h1 className="mt-4 text-xl font-semibold">Application submitted</h1><p className="mt-2 text-sm text-muted-foreground">The office will review your details. Your FBO will receive the status.</p></div></main>;
  const field = (key: keyof typeof form, label: string, type = "text") => <div><Label>{label}</Label><Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>;
  return <main className="min-h-screen bg-background px-4 py-6"><div className="mx-auto max-w-2xl space-y-5"><header className="flex items-center justify-between"><BackButton fallback="/" /><BrandLogo size="sm" /><ThemeSwitch /></header><section><p className="text-xs font-semibold uppercase text-primary">Private application · FBO {info.data?.fboName}</p><h1 className="mt-2 text-3xl font-semibold">Skyline Growth Executive</h1><p className="mt-2 text-sm text-muted-foreground">Enter accurate active details. The office verifies every application before creating an account.</p></section><section className="glass-panel space-y-4 rounded-2xl p-5"><div className="grid gap-4 sm:grid-cols-2">{field("fullName", "Full name")}{field("phone", "Active phone", "tel")}{field("email", "Active email", "email")}{field("cnic", "CNIC number")}{field("qualification", "Qualification")}{field("city", "City")}</div><div><Label>Experience</Label><Textarea value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} /></div><div><Label>Executive role</Label><div className="mt-2 grid grid-cols-2 gap-2"><Button type="button" variant={form.requestedRole === "calling" ? "default" : "outline"} onClick={() => setForm({ ...form, requestedRole: "calling" })}>Calling Executive</Button><Button type="button" variant={form.requestedRole === "full_funnel" ? "default" : "outline"} onClick={() => setForm({ ...form, requestedRole: "full_funnel" })}>Full Funnel</Button></div></div><div className="grid gap-4 sm:grid-cols-3">{field("payoutMethod", "Payout method")}{field("payoutAccountTitle", "Account title")}{field("payoutAccountNumber", "Account number")}</div><div className="grid gap-3 sm:grid-cols-2"><ImagePicker label="CNIC front image" file={cnicFile} onFile={setCnicFile} /><ImagePicker label="Profile picture" file={avatarFile} onFile={setAvatarFile} /></div>{progress > 0 && progress < 100 && <p className="text-xs text-primary">Uploading securely… {progress}%</p>}<Button className="w-full" disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Submit application</Button></section></div></main>;
}

function ImagePicker({ label, file, onFile }: { label: string; file: File | null; onFile: (file: File | null) => void }) { return <label className="cursor-pointer rounded-xl border border-dashed border-border p-4 text-center text-sm"><Upload className="mx-auto mb-2 size-5 text-primary" />{file?.name ?? label}<input className="hidden" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>; }