import { useCallback, useState } from "react";

import type { ProgressInfo } from "@/lib/upload-progress";

export type UploadState = {
  label: string;
  percent: number;
  secondsLeft: number | null;
  bytesPerSecond: number;
} | null;

/** Tracks the percentage of the file that has already reached the website. */
export function useUploadProgress() {
  const [state, setState] = useState<UploadState>(null);

  const handler = useCallback(
    (label: string) => (percent: number, info?: ProgressInfo) =>
      setState({
        label,
        percent,
        secondsLeft: info?.secondsLeft ?? null,
        bytesPerSecond: info?.bytesPerSecond ?? 0,
      }),
    [],
  );
  const clear = useCallback(() => setState(null), []);

  return { state, handler, clear };
}

function formatLeft(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  if (seconds < 60) return `${seconds}s left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m left`;
}

export function UploadProgress({ state }: { state: UploadState }) {
  if (!state) return null;
  const left = formatLeft(state.secondsLeft);
  const speed = state.bytesPerSecond > 0 ? state.bytesPerSecond / (1024 * 1024) : 0;
  return (
    <div
      className="space-y-1.5 rounded-2xl border border-hairline bg-surface-2 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="truncate text-muted-foreground">{state.label}</span>
        <span className="tabular-nums text-brand">{state.percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline bg-surface-2">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
          style={{ width: `${state.percent}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {state.percent < 100
          ? [left, speed > 0.05 ? `${speed.toFixed(1)} MB/s` : null]
              .filter(Boolean)
              .join(" · ")
              .concat(left || speed > 0.05 ? " · keep this page open" : "Uploading… keep this page open.")
          : "Finishing up…"}
      </p>
    </div>
  );
}
