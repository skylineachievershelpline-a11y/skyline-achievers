import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Loader2, MessageSquareQuote, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getLandingReviews } from "@/lib/landing.functions";

/**
 * Public testimonials wall. Visitors submit a review, it stays hidden until an
 * administrator approves it in the admin panel.
 */
export function ReviewsSection() {
  const loadReviews = useServerFn(getLandingReviews);
  const { data: result, isPending } = useQuery({
    queryKey: ["landing-reviews"],
    queryFn: () => loadReviews(),
    retry: false,
  });
  const data = result?.reviews;


  return (
    <section id="reviews" className="section-flow relative overflow-hidden border-b border-hairline px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">
              Success stories
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Stories from our community
            </h2>
          </div>
          <ReviewDialog />
        </div>

        {isPending ? (
          <div className="flex justify-center py-10">
            <SkylineLoader />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted-foreground">
            No testimonials published yet. Be the first to share your experience.
          </p>
        ) : (
          <ReviewStack reviews={data ?? []} />
        )}
      </div>
    </section>
  );
}

type Review = NonNullable<Awaited<ReturnType<typeof getLandingReviews>>["reviews"]>[number];

function ReviewStack({ reviews }: { reviews: Review[] }) {
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const next = () => {
    if (leaving || reviews.length < 2) return;
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setActive((current) => (current + 1) % reviews.length);
      setLeaving(false);
    }, 420);
  };

  const visible = Array.from({ length: Math.min(3, reviews.length) }, (_, offset) => {
    const review = reviews[(active + offset) % reviews.length];
    return review ? { review, offset } : null;
  }).filter((item): item is { review: Review; offset: number } => item !== null);

  return (
    <div className="review-stage" aria-live="polite">
      <div className="review-watermark" aria-hidden>
        <span>SKYLINE</span>
        <strong>ACHIEVERS</strong>
      </div>
      <div className="review-stack">
        {visible.slice().reverse().map(({ review, offset }) => (
          <article
            key={`${review.id}-${active}-${offset}`}
            className={`review-card metal-edge ${offset === 0 && leaving ? "is-leaving" : ""}`}
            data-depth={offset}
            aria-hidden={offset !== 0}
          >
            <div className="review-card-inner">
              {review.videoUrl ? (
                <div className="review-video">
                  <SessionVideo title={review.personName} videoUrl={review.videoUrl} aspectRatio={review.aspectRatio} />
                </div>
              ) : (
                <span className="review-quote-mark"><MessageSquareQuote className="h-5 w-5" /></span>
              )}
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-foreground">{review.personName}</p>
                  {review.designation ? <p className="truncate text-xs text-muted-foreground">{review.designation}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5" aria-label={`${review.rating ?? 5} stars`}>
                  {Array.from({ length: review.rating ?? 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-cyan text-cyan" />
                  ))}
                </div>
              </div>
              {review.reviewText ? <p className="review-copy mt-4 text-sm leading-6 text-silver">“{review.reviewText}”</p> : null}
            </div>
          </article>
        ))}
      </div>
      <div className="review-controls">
        <div className="flex items-center gap-2" aria-label={`Review ${active + 1} of ${reviews.length}`}>
          {reviews.map((review, index) => (
            <span key={review.id} className={`review-dot ${index === active ? "is-active" : ""}`} />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{active + 1} / {reviews.length}</span>
        <Button variant="brand" size="sm" onClick={next} disabled={reviews.length < 2}>
          Next <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ReviewDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);

  const submit = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const trimmedText = text.trim();
      if (trimmedName.length < 2 || trimmedName.length > 80) throw new Error("Enter your name.");
      if (trimmedText.length < 10 || trimmedText.length > 600)
        throw new Error("Write a few words about your experience.");
      const { error } = await supabase.from("landing_reviews").insert({
        person_name: trimmedName,
        designation: designation.trim().slice(0, 80) || null,
        review_text: trimmedText,
        rating,
        status: "pending",
        is_active: false,
        sort_order: 0,
        photo_path: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Thank you! Your review will appear once it is approved.");
      setOpen(false);
      setName("");
      setDesignation("");
      setText("");
      setRating(5);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg border-hairline">
          Write a review
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Share your experience</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reviewName">Your name</Label>
            <Input
              id="reviewName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewRole">City or role (optional)</Label>
            <Input
              id="reviewRole"
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
              className="h-11 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewText">Your review</Label>
            <Textarea
              id="reviewText"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} star`}
                >
                  <Star
                    className={
                      value <= rating
                        ? "h-6 w-6 fill-brand text-brand"
                        : "h-6 w-6 text-muted-foreground"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="brand"
            size="xl"
            className="w-full"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? <Loader2 className="animate-spin" /> : null}
            Submit review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
