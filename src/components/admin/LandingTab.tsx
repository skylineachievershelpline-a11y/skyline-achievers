import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Pencil, Plus, Quote, Trash2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { uploadToBucket } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUploadUrl,
  adminDeleteLandingQuote,
  adminDeleteLandingReview,
  adminGetLandingContent,
  adminSaveLandingIntro,
  adminSaveLandingQuote,
  adminSaveLandingReview,
} from "@/lib/admin.functions";

type QuoteRow = { id: string; quote_text: string; is_active: boolean; sort_order: number };
type IntroRow = { title: string; description: string | null; video_source: "upload" | "external"; video_path: string | null; video_url: string | null; thumbnail_path: string | null; aspect_ratio: string; is_active: boolean };
type ReviewRow = { id: string; person_name: string; designation: string | null; review_text: string; rating: number | null; status: "pending" | "approved" | "rejected"; is_active: boolean; sort_order: number; created_at: string };

const panel = "rounded-lg border border-hairline bg-surface p-4 sm:p-6";

export function LandingTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetLandingContent);
  const saveQuote = useServerFn(adminSaveLandingQuote);
  const deleteQuote = useServerFn(adminDeleteLandingQuote);
  const saveIntro = useServerFn(adminSaveLandingIntro);
  const saveReview = useServerFn(adminSaveLandingReview);
  const deleteReview = useServerFn(adminDeleteLandingReview);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const progress = useUploadProgress();
  const { data, isPending } = useQuery({ queryKey: ["admin-landing"], queryFn: () => load() });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-landing"] });

  if (isPending || !data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-5">
      <IntroEditor intro={(data.intro ?? null) as IntroRow | null} save={saveIntro} createUploadUrl={createUploadUrl} refresh={refresh} progress={progress} />
      <QuoteEditor quotes={(data.quotes ?? []) as QuoteRow[]} save={saveQuote} remove={deleteQuote} refresh={refresh} />
      <ReviewEditor reviews={(data.reviews ?? []) as ReviewRow[]} save={saveReview} remove={deleteReview} refresh={refresh} />
    </div>
  );
}

function IntroEditor({ intro, save, createUploadUrl, refresh, progress }: any) {
  const [title, setTitle] = useState(intro?.title ?? "What is Skyline Achievers?");
  const [description, setDescription] = useState(intro?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(intro?.video_url ?? "");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [ratio, setRatio] = useState(intro?.aspect_ratio ?? "16:9");
  const [active, setActive] = useState(intro?.is_active ?? false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    progress.clear();
    try {
      const videoPath = videoFile ? await uploadToBucket(createUploadUrl, "training-videos", videoFile, progress.handler("Uploading intro video")) : undefined;
      const thumbnailPath = thumbnailFile ? await uploadToBucket(createUploadUrl, "training-thumbnails", thumbnailFile, progress.handler("Uploading intro cover")) : undefined;
      await save({ data: { title, description: description || null, videoSource: videoFile ? "upload" : "external", videoPath, videoUrl: videoFile ? null : videoUrl || null, thumbnailPath, aspectRatio: ratio, isActive: active } });
      toast.success("Introduction updated");
      setVideoFile(null);
      setThumbnailFile(null);
      refresh();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); progress.clear(); }
  }

  return <section className={panel}>
    <div className="mb-5 flex items-center gap-3"><Video className="h-5 w-5 text-brand-glow" /><div><h2 className="font-display text-lg font-semibold">Introduction video</h2><p className="text-xs text-muted-foreground">Manage the public landing video and message.</p></div></div>
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Video link</Label><Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube, Vimeo, Drive or direct video link" disabled={Boolean(videoFile)} /></div>
      <div className="space-y-2 lg:col-span-2"><Label>Short description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} /></div>
      <div className="space-y-2"><Label>Upload video (optional)</Label><Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} /></div>
      <div className="space-y-2"><Label>Cover image (optional)</Label><Input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)} /></div>
      <div className="space-y-2"><Label>Video ratio</Label><Select value={ratio} onValueChange={setRatio}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["16:9","9:16","1:1","4:3"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex items-center gap-3"><Switch checked={active} onCheckedChange={setActive} /><Label>Show on landing page</Label></div>
      <div className="lg:col-span-2"><UploadProgress state={progress.state} /></div>
      <Button type="submit" variant="brand" disabled={busy} className="lg:col-span-2">{busy ? <Loader2 className="animate-spin" /> : null}Save introduction</Button>
    </form>
  </section>;
}

function QuoteEditor({ quotes, save, remove, refresh }: any) {
  const [text, setText] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const del = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { toast.success("Quote deleted"); refresh(); }, onError: (error: Error) => toast.error(error.message) });
  const reset = () => { setText(""); setSortOrder("0"); setActive(true); setEditing(null); };
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { await save({ data: { id: editing ?? undefined, quoteText: text, isActive: active, sortOrder: Number(sortOrder) || 0 } }); toast.success(editing ? "Quote updated" : "Quote added"); reset(); refresh(); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); } }
  return <section className={panel}>
    <div className="mb-5 flex items-center gap-3"><Quote className="h-5 w-5 text-brand-glow" /><div><h2 className="font-display text-lg font-semibold">Floating quotes</h2><p className="text-xs text-muted-foreground">Active quotes move gently across the landing page.</p></div></div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px_auto_auto]">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Motivational quote" required maxLength={280} />
      <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ""))} aria-label="Quote order" />
      <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><span className="text-xs">Active</span></div>
      <Button type="submit" variant="brand" disabled={busy}>{editing ? <Pencil /> : <Plus />}{editing ? "Save" : "Add"}</Button>
    </form>
    <ul className="mt-4 space-y-2">{quotes.map((row: QuoteRow) => <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-hairline bg-background/35 p-3"><div className="min-w-0"><p className="text-sm">“{row.quote_text}”</p><p className="mt-1 text-xs text-muted-foreground">Order {row.sort_order} · {row.is_active ? "Active" : "Hidden"}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Edit quote" onClick={() => { setEditing(row.id); setText(row.quote_text); setSortOrder(String(row.sort_order)); setActive(row.is_active); }}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Delete quote" onClick={() => del.mutate(row.id)}><Trash2 /></Button></div></li>)}</ul>
  </section>;
}

function ReviewEditor({ reviews, save, remove, refresh }: any) {
  const del = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { toast.success("Review deleted"); refresh(); }, onError: (error: Error) => toast.error(error.message) });
  async function update(row: ReviewRow, patch: Partial<ReviewRow>) { try { const next = { ...row, ...patch }; await save({ data: { id: next.id, personName: next.person_name, designation: next.designation, reviewText: next.review_text, rating: next.rating, status: next.status, isActive: next.is_active, sortOrder: next.sort_order } }); toast.success("Review updated"); refresh(); } catch (error) { toast.error((error as Error).message); } }
  const pending = reviews.filter((review: ReviewRow) => review.status === "pending");
  return <section className={panel}>
    <div className="mb-5"><h2 className="font-display text-lg font-semibold">Review moderation</h2><p className="text-xs text-muted-foreground">Approve genuine submissions before they become public.</p></div>
    {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No reviews have been submitted yet.</p> : <ul className="space-y-3">{[...pending, ...reviews.filter((review: ReviewRow) => review.status !== "pending")].map((row: ReviewRow) => <li key={row.id} className="rounded-lg border border-hairline bg-background/35 p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="font-semibold">{row.person_name}{row.designation ? <span className="font-normal text-muted-foreground"> · {row.designation}</span> : null}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">“{row.review_text}”</p><p className="mt-2 text-xs uppercase text-brand-glow">{row.status} · order {row.sort_order}</p></div><Button variant="ghost" size="icon" aria-label="Delete review" onClick={() => del.mutate(row.id)}><Trash2 /></Button></div><div className="mt-3 flex flex-wrap gap-2">{row.status !== "approved" ? <Button size="sm" onClick={() => update(row, { status: "approved", is_active: true })}><Check />Approve</Button> : <Button size="sm" variant="outline" onClick={() => update(row, { is_active: !row.is_active })}>{row.is_active ? "Hide" : "Show"}</Button>}{row.status !== "rejected" ? <Button size="sm" variant="outline" onClick={() => update(row, { status: "rejected", is_active: false })}><X />Reject</Button> : null}</div></li>)}</ul>}
  </section>;
}