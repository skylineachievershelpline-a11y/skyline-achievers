import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { dismissUpload, guardUnload, subscribeUploads, type UploadJob } from "@/lib/upload-manager";

function formatLeft(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

/**
 * Small floating strip that keeps showing every upload in progress, even after
 * the form that started it is closed.
 */
export function UploadDock() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  useEffect(() => {
    guardUnload();
    return subscribeUploads(setJobs);
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto w-full max-w-sm space-y-2">
        {jobs.map((job) => {
          const speed = job.bytesPerSecond / (1024 * 1024);
          const left = formatLeft(job.secondsLeft);
          return (
            <div key={job.id} className="raised-panel metal-edge rounded-2xl p-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                {job.status === "uploading" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : job.status === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan" />
                ) : (
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-brand-glow" />
                )}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{job.label}</span>
                <span className="tabular-nums text-primary">{job.percent}%</span>
                <button
                  type="button"
                  aria-label="Hide"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => dismissUpload(job.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${job.percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {job.status === "failed"
                  ? (job.error ?? "Upload failed")
                  : job.status === "done"
                    ? "Uploaded"
                    : [left, speed > 0.05 ? `${speed.toFixed(1)} MB/s` : null, "keeps going in the background"]
                        .filter(Boolean)
                        .join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
