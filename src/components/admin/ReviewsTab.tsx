import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, EyeOff, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { frameFromVideo } from "@/components/admin/ReelsTab";
import { uploadToBucket } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import {
  adminDeleteReview,
  adminGetLandingIntroduction,
  adminGetReviews,
  adminSaveLandingIntroduction,
  adminSaveReview,
  adminSetReviewStatus,
} from "@/lib/admin-landing.functions";
import { formatDateTime } from "@/lib/format";

const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
const fieldClass = "h-11 w-full rounded-lg border border-hairline bg-surface-2 px-3 text-sm";

type ReviewRow = {
  id: string;
  person_name: string;
  designation: string | null;
  review_text: string;
  rating: number | null;
  sort_order: number;
  status: string;
  is_active: boolean;
  created_at: string;
  video_source?: string | null;
  video_path?: string | null;
  video_url?: string | null;
  aspect_ratio?: string | null;
};

/** Controls the public introduction video and all landing testimonials. */
export function ReviewsTab() {
  return (
    <div className="space-y-8">
      <IntroductionManager />
      <TestimonialsManager />
    </div>
  );
}

function IntroductionManager() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetLandingIntroduction);
  const save = useServerFn(adminSaveLandingIntroduction);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const uploadProgress = useUploadProgress();
  const { data, isPending } = useQuery({
    queryKey: ["admin-landing-introduction"],
    queryFn: () => load(),
  });
  const row = data?.introduction;
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState<string | null>(null);
  const [active, setActive] = useState<boolean | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const finalTitle = title ?? row?.title ?? "Meet Skyline Achievers";
    const finalUrl = videoUrl ?? row?.video_url ?? "";
    if (!videoFile && !finalUrl && !row?.video_path) {
      toast.error("Upload a video or paste a video link.");
      return;
    }
    setBusy(true);
    uploadProgress.clear();
    try {
      let videoPath: string | null = null;
      let thumbnailPath: string | null = null;
      if (videoFile) {
        videoPath = await uploadToBucket(
          createUploadUrl,
          "training-videos",
          videoFile,
          uploadProgress.handler("Uploading introduction video"),
        );
      }
      const coverFile = cover ?? (videoFile ? await frameFromVideo(videoFile) : null);
      if (coverFile) {
        thumbnailPath = await uploadToBucket(
          createUploadUrl,
          "training-thumbnails",
          coverFile,
          uploadProgress.handler("Uploading cover image"),
        );
      }
      await save({
        data: {
          id: row?.id,
          title: finalTitle,
          description: description ?? row?.description ?? null,
          videoPath,
          videoUrl: videoFile ? null : finalUrl || null,
          thumbnailPath,
          aspectRatio: ratio ?? row?.aspect_ratio ?? "16:9",
          isActive: active ?? row?.is_active ?? true,
        },
      } as never);
      toast.success("Landing introduction saved");
      setVideoFile(null);
      setCover(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-landing-introduction"] });
      void queryClient.invalidateQueries({ queryKey: ["landing-introduction"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  if (isPending) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" />;

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">Landing video</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Skyline introduction</h2>
      </div>
      <form onSubmit={submit} className="glass-panel grid gap-4 rounded-2xl p-5 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="introTitle">Title</Label>
          <Input
            id="introTitle"
            value={title ?? row?.title ?? "Meet Skyline Achievers"}
            onChange={(event) => setTitle(event.target.value)}
            className="h-11 rounded-lg"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="introDescription">Description</Label>
          <Textarea
            id="introDescription"
            rows={4}
            value={description ?? row?.description ?? ""}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="introVideo">Upload video</Label>
          <input
            id="introVideo"
            type="file"
            accept="video/*"
            className={`${fieldClass} py-2.5 text-xs text-muted-foreground`}
            onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="introLink">Or video link</Label>
          <Input
            id="introLink"
            value={videoUrl ?? row?.video_url ?? ""}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://youtube.com/..."
            className="h-11 rounded-lg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="introCover">Cover image (optional)</Label>
          <input
            id="introCover"
            type="file"
            accept="image/*"
            className={`${fieldClass} py-2.5 text-xs text-muted-foreground`}
            onChange={(event) => setCover(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="introRatio">Video ratio</Label>
          <select
            id="introRatio"
            value={ratio ?? row?.aspect_ratio ?? "16:9"}
            onChange={(event) => setRatio(event.target.value)}
            className={fieldClass}
          >
            {RATIOS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
          <input
            type="checkbox"
            checked={active ?? row?.is_active ?? true}
            onChange={(event) => setActive(event.target.checked)}
          />
          Show this introduction on the landing page
        </label>
        <div className="md:col-span-2"><UploadProgress state={uploadProgress.state} /></div>
        <Button type="submit" variant="brand" size="xl" disabled={busy} className="md:col-span-2 md:justify-self-start">
          {busy ? <Loader2 className="animate-spin" /> : null} Save introduction
        </Button>
      </form>
    </section>
  );
}

function TestimonialsManager() {
  const queryClient = useQueryClient();
  const loadList = useServerFn(adminGetReviews);
  const setStatus = useServerFn(adminSetReviewStatus);
  const saveReview = useServerFn(adminSaveReview);
  const remove = useServerFn(adminDeleteReview);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const uploadProgress = useUploadProgress();
  const { data, isPending } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => loadList() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [order, setOrder] = useState("0");
  const [visible, setVisible] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState("");
  const [videoRatio, setVideoRatio] = useState<string>("16:9");


  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["landing-reviews"] });
  }
  function startAdd() {
    setEditing(null); setName(""); setDesignation(""); setText(""); setRating(5); setOrder("0"); setVisible(true);
    setVideoFile(null); setVideoLink(""); setVideoRatio("16:9"); setOpen(true);
  }
  function startEdit(row: ReviewRow) {
    setEditing(row); setName(row.person_name); setDesignation(row.designation ?? ""); setText(row.review_text);
    setRating(row.rating ?? 5); setOrder(String(row.sort_order)); setVisible(row.is_active);
    setVideoFile(null); setVideoLink(row.video_url ?? ""); setVideoRatio(row.aspect_ratio ?? "16:9"); setOpen(true);
  }
  const change = useMutation({
    mutationFn: (values: { id: string; status: "approved" | "pending" | "rejected" }) => setStatus({ data: values } as never),
    onSuccess: () => { toast.success("Testimonial updated"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } } as never),
    onSuccess: () => { toast.success("Testimonial deleted"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: async () => {
      let videoPath: string | null = null;
      if (videoFile) {
        videoPath = await uploadToBucket(
          createUploadUrl,
          "training-videos",
          videoFile,
          uploadProgress.handler("Uploading testimonial video"),
        );
      }
      return saveReview({
        data: {
          id: editing?.id,
          personName: name,
          designation,
          reviewText: text,
          rating,
          sortOrder: Number(order) || 0,
          isActive: visible,
          videoPath,
          videoUrl: videoFile ? null : videoLink.trim() || null,
          aspectRatio: videoRatio,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success(editing ? "Testimonial saved" : "Testimonial added");
      setOpen(false); uploadProgress.clear(); setVideoFile(null); refresh();
    },
    onError: (error: Error) => { uploadProgress.clear(); toast.error(error.message); },
  });

  const reviews = (data?.reviews ?? []) as ReviewRow[];
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">Social proof</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Testimonials</h2>
        </div>
        <Button variant="brand" onClick={startAdd}><Plus /> Add testimonial</Button>
      </div>
      {isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" /> : reviews.length === 0 ? (
        <p className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">No testimonials yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-display font-semibold">{review.person_name}</p><p className="text-[11px] text-muted-foreground">{review.designation ? `${review.designation} · ` : ""}{formatDateTime(review.created_at)}</p></div>
                <span className="rounded-full border border-hairline px-2 py-1 text-[10px] uppercase text-muted-foreground">{review.status}</span>
              </div>
              <div className="mt-2 flex gap-0.5">{Array.from({ length: review.rating ?? 5 }).map((_, index) => <Star key={index} className="h-3.5 w-3.5 fill-brand text-brand" />)}</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.review_text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => startEdit(review)}><Pencil /> Edit</Button>
                <Button size="sm" variant="brand" disabled={change.isPending || review.status === "approved"} onClick={() => change.mutate({ id: review.id, status: "approved" })}><Check /> Publish</Button>
                <Button size="sm" variant="outline" disabled={change.isPending || review.status === "rejected"} onClick={() => change.mutate({ id: review.id, status: "rejected" })}><EyeOff /> Hide</Button>
                <Button size="sm" variant="destructive" disabled={destroy.isPending} onClick={() => destroy.mutate(review.id)}><Trash2 /> Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit testimonial" : "Add testimonial"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="testimonialName">Person name</Label><Input id="testimonialName" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="testimonialRole">Role or city</Label><Input id="testimonialRole" value={designation} onChange={(event) => setDesignation(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="testimonialText">Testimonial</Label><Textarea id="testimonialText" rows={5} value={text} onChange={(event) => setText(event.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="testimonialRating">Rating</Label><select id="testimonialRating" className={fieldClass} value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="testimonialOrder">Order</Label><Input id="testimonialOrder" value={order} onChange={(event) => setOrder(event.target.value.replace(/\D/g, ""))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Show on landing page</label>
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : null} Save testimonial</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}