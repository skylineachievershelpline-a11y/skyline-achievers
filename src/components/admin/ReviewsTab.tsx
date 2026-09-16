import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, EyeOff, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  adminDeleteReview,
  adminGetReviews,
  adminSetReviewStatus,
} from "@/lib/admin-landing.functions";
import { formatDateTime } from "@/lib/format";

/** Approve, hide or delete the reviews visitors submit on the landing page. */
export function ReviewsTab() {
  const queryClient = useQueryClient();
  const loadList = useServerFn(adminGetReviews);
  const setStatus = useServerFn(adminSetReviewStatus);
  const remove = useServerFn(adminDeleteReview);

  const { data, isPending } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => loadList(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
  }

  const change = useMutation({
    mutationFn: (values: { id: string; status: "approved" | "pending" | "rejected" }) =>
      setStatus({ data: values } as never),
    onSuccess: () => {
      toast.success("Review updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Review deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const reviews = (data?.reviews ?? []) as any[];

  return (
    <div className="space-y-3">
      {reviews.length === 0 ? (
        <p className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground">
          No reviews submitted yet.
        </p>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="glass-panel rounded-3xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{review.person_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {review.designation ? `${review.designation} · ` : ""}
                  {formatDateTime(review.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: review.rating ?? 5 }).map((_, index) => (
                  <Star key={index} className="h-3.5 w-3.5 fill-brand text-brand" />
                ))}
                <span className="ml-2 rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {review.status}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.review_text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="brand"
                className="rounded-xl"
                disabled={change.isPending || review.status === "approved"}
                onClick={() => change.mutate({ id: review.id, status: "approved" })}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={change.isPending || review.status === "rejected"}
                onClick={() => change.mutate({ id: review.id, status: "rejected" })}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hide
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl"
                disabled={destroy.isPending}
                onClick={() => destroy.mutate(review.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
