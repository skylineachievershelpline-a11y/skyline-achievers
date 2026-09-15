import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitLandingReview } from "@/lib/landing.functions";

export function ReviewForm() {
  const submitReview = useServerFn(submitLandingReview);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [review, setReview] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await submitReview({
        data: {
          personName: name,
          designation: designation || null,
          reviewText: review,
          rating,
        },
      });
      setSent(true);
      setName("");
      setDesignation("");
      setReview("");
      setRating(null);
    } catch (submissionError) {
      setError((submissionError as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="grid min-h-80 place-items-center p-6 text-center">
        <div>
          <CheckCircle2 className="mx-auto h-9 w-9 text-brand-glow" />
          <h3 className="mt-4 font-display text-xl font-semibold">Thank you for sharing</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your review has been sent for approval.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>
            Write another review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="review-name">Your name</Label>
          <Input id="review-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-title">Title (optional)</Label>
          <Input id="review-title" value={designation} onChange={(event) => setDesignation(event.target.value)} maxLength={100} className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="review-text">Your experience</Label>
        <Textarea id="review-text" value={review} onChange={(event) => setReview(event.target.value)} minLength={10} maxLength={700} required className="min-h-28" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Rating (optional)</Label>
          <div className="mt-2 flex gap-1" aria-label="Choose a rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                onClick={() => setRating(value)}
                className={value <= (rating ?? 0) ? "text-brand-glow" : "text-muted-foreground"}
              >
                <Star className={value <= (rating ?? 0) ? "fill-current" : ""} />
              </Button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="brand" size="xl" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Submit review
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive-foreground">{error}</p> : null}
      <p className="text-xs leading-5 text-muted-foreground">Reviews appear only after approval.</p>
    </form>
  );
}