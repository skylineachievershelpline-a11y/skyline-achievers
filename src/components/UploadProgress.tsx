import { useCallback, useState } from "react";

export type UploadState = { label: string; percent: number } | null;

/** Tracks the percentage of the file that has already reached the website. */
export function useUploadProgress() {
  const [state, setState] = useState<UploadState>(null);

  const handler = useCallback(
    (label: string) => (percent: number) => setState({ label, percent }),
    [],
  );
  const clear = useCallback(() => setState(null), []);

  return { state, handler, clear };
}

export function UploadProgress({ state }: { state: UploadState }) {
  if (!state) return null;
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
        {state.percent < 100 ? "Uploading… please keep this page open." : "Finishing up…"}
      </p>
    </div>
  );
}
