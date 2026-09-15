import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { frameFromVideo } from "./ReelsTab";
import { uploadToBucket } from "./upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import { adminDeleteLandingQuote, adminDeleteLandingReview, adminGetLandingContent, adminSaveLandingIntro, adminSaveLandingQuote, adminSaveLandingReview } from "@/lib/landing.functions";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

type IntroValues = { title: string; description: string; videoUrl: string; videoFile: File | null; cover: File | null; aspectRatio: string; isActive: boolean };
type QuoteValues = { id?: string; quoteText: string; sortOrder: number; isActive: boolean };
type ReviewValues = { id?: string; personName: string; designation: string; reviewText: string; rating: number; status: "pending" | "approved" | "rejected"; sortOrder: number; isActive: boolean };

export function LandingTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminGetLandingContent);
  const saveIntro = useServerFn(adminSaveLandingIntro);
  const saveQuote = useServerFn(adminSaveLandingQuote);
  const deleteQuote = useServerFn(adminDeleteLandingQuote);
  const saveReview = useServerFn(adminSaveLandingReview);
  const deleteReview = useServerFn(adminDeleteLandingReview);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const progress = useUploadProgress();
  const query = useQuery({ queryKey: ["admin-landing"], queryFn: () => load() });
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-landing"] });

  if (query.isPending || !query.data) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;
  const { intro, quotes, reviews } = query.data as any;

  return <div className="space-y-10">
    <IntroEditor intro={intro} busy={busy} progress={progress} onSave={async (values: IntroValues) => {
      setBusy(true); progress.clear();
      try {
        let videoPath: string | null = null; let thumbnailPath: string | null = null;
        if (values.videoFile) videoPath = await uploadToBucket(createUploadUrl, "training-videos", values.videoFile, progress.handler("Uploading intro video"));
        const cover = values.cover ?? (values.videoFile ? await frameFromVideo(values.videoFile) : null);
        if (cover) thumbnailPath = await uploadToBucket(createUploadUrl, "training-thumbnails", cover, progress.handler("Uploading cover image"));
        await saveIntro({ data: { title: values.title, description: values.description, videoUrl: values.videoUrl, videoPath, thumbnailPath, aspectRatio: values.aspectRatio, isActive: values.isActive } });
        toast.success("Landing intro updated"); refresh();
      } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); progress.clear(); }
    }} />
    <section>
      <h3 className="mb-4 font-display text-lg font-semibold">Floating quotes</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <QuoteEditor onSave={async (value: QuoteValues) => { await saveQuote({ data: value }); toast.success("Quote added"); refresh(); }} />
        <div className="space-y-2">{quotes.map((quote: any) => <QuoteEditor key={quote.id} quote={quote} onSave={async (value: QuoteValues) => { await saveQuote({ data: value }); toast.success("Quote updated"); refresh(); }} onDelete={async () => { await deleteQuote({ data: { id: quote.id } }); refresh(); }} />)}</div>
      </div>
    </section>
    <section>
      <h3 className="mb-4 font-display text-lg font-semibold">Reviews</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <ReviewEditor onSave={async (value: ReviewValues) => { await saveReview({ data: value }); toast.success("Review added"); refresh(); }} />
        <div className="space-y-2">{reviews.map((review: any) => <ReviewEditor key={review.id} review={review} onSave={async (value: ReviewValues) => { await saveReview({ data: value }); toast.success("Review updated"); refresh(); }} onDelete={async () => { await deleteReview({ data: { id: review.id } }); refresh(); }} />)}</div>
      </div>
    </section>
  </div>;
}

function IntroEditor({ intro, busy, progress, onSave }: any) {
  const [title, setTitle] = useState(intro?.title ?? "What is Skyline Achievers?");
  const [description, setDescription] = useState(intro?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(intro?.video_url ?? "");
  const [videoFile, setVideoFile] = useState<File | null>(null); const [cover, setCover] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState(intro?.aspect_ratio ?? "16:9"); const [isActive, setIsActive] = useState(intro?.is_active ?? false);
  return <form className="glass-panel-strong space-y-4 rounded-3xl p-6" onSubmit={(e) => { e.preventDefault(); void onSave({ title, description, videoUrl, videoFile, cover, aspectRatio, isActive }); }}>
    <div><p className="text-xs uppercase text-brand-glow">Landing video</p><h3 className="mt-1 font-display text-xl font-semibold">Intro feature</h3></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label>Title</Label><Input className="mt-1 h-11 rounded-2xl" value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><Label>Video ratio</Label><select className={`${fieldClass} mt-1`} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>{["16:9","9:16","1:1","4:3"].map(x => <option key={x}>{x}</option>)}</select></div></div>
    <div><Label>Short description</Label><Textarea className="mt-1 rounded-2xl" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    <div><Label>Video link</Label><Input className="mt-1 h-11 rounded-2xl" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Optional when uploading" /></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Upload video<input className={`${fieldClass} mt-1 py-2`} type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} /></label><label className="text-xs text-muted-foreground">Cover image<input className={`${fieldClass} mt-1 py-2`} type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></label></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Show on landing page</label>
    <UploadProgress state={progress.state} /><Button type="submit" variant="brand" size="xl" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save intro</Button>
  </form>;
}

function QuoteEditor({ quote, onSave, onDelete }: any) {
  const [editing, setEditing] = useState(!quote); const [text, setText] = useState(quote?.quote_text ?? ""); const [order, setOrder] = useState(String(quote?.sort_order ?? 0)); const [active, setActive] = useState(quote?.is_active ?? true);
  if (!editing) return <div className="glass-panel flex items-start gap-3 rounded-2xl p-4"><p className="min-w-0 flex-1 text-sm">“{quote.quote_text}”</p><Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil /></Button><Button size="icon" variant="ghost" onClick={onDelete}><Trash2 /></Button></div>;
  return <form className="glass-panel space-y-3 rounded-2xl p-4" onSubmit={(e) => { e.preventDefault(); void onSave({ id: quote?.id, quoteText: text, sortOrder: Number(order)||0, isActive: active }); if (!quote) setText(""); else setEditing(false); }}><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Quote" className="rounded-xl" /><div className="flex items-center gap-3"><Input value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g,""))} className="h-10 w-24 rounded-xl" aria-label="Sort order" /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label><Button className="ml-auto" type="submit" variant="brand">{quote ? "Save" : <><Plus />Add</>}</Button></div></form>;
}

function ReviewEditor({ review, onSave, onDelete }: any) {
  const [editing, setEditing] = useState(!review); const [name, setName] = useState(review?.person_name ?? ""); const [designation, setDesignation] = useState(review?.designation ?? ""); const [text, setText] = useState(review?.review_text ?? ""); const [rating, setRating] = useState(String(review?.rating ?? 5)); const [status, setStatus] = useState(review?.status ?? "approved"); const [order, setOrder] = useState(String(review?.sort_order ?? 0)); const [active, setActive] = useState(review?.is_active ?? true);
  if (!editing) return <div className="glass-panel flex items-start gap-3 rounded-2xl p-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{review.person_name} · {review.status}</p><p className="line-clamp-2 text-xs text-muted-foreground">{review.review_text}</p></div><Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil /></Button><Button size="icon" variant="ghost" onClick={onDelete}><Trash2 /></Button></div>;
  return <form className="glass-panel space-y-3 rounded-2xl p-4" onSubmit={(e) => { e.preventDefault(); void onSave({ id: review?.id, personName: name, designation, reviewText: text, rating: Number(rating), status, sortOrder: Number(order)||0, isActive: active }); if (!review) { setName(""); setText(""); } else setEditing(false); }}><div className="grid grid-cols-2 gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person name" className="h-10 rounded-xl" /><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Designation" className="h-10 rounded-xl" /></div><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Review" className="rounded-xl" /><div className="grid grid-cols-3 gap-2"><select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select><Input value={rating} onChange={(e) => setRating(e.target.value)} className="h-11 rounded-xl" aria-label="Rating" /><Input value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g,""))} className="h-11 rounded-xl" aria-label="Sort order" /></div><div className="flex items-center"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label><Button className="ml-auto" type="submit" variant="brand">{review ? "Save" : <><Plus />Add</>}</Button></div></form>;
}