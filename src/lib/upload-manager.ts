import { putWithProgress, type ProgressInfo } from "./upload-progress";

/**
 * Uploads live outside the React tree, so closing a form or moving to another
 * page never cancels a file that is already on its way.
 */
export type UploadJob = {
  id: string;
  label: string;
  percent: number;
  bytesPerSecond: number;
  secondsLeft: number | null;
  status: "uploading" | "done" | "failed";
  error?: string;
};

type Listener = (jobs: UploadJob[]) => void;

const jobs = new Map<string, UploadJob>();
const listeners = new Set<Listener>();

function emit() {
  const list = [...jobs.values()];
  for (const listener of listeners) listener(list);
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener);
  listener([...jobs.values()]);
  return () => listeners.delete(listener);
}

export function activeUploadCount(): number {
  return [...jobs.values()].filter((job) => job.status === "uploading").length;
}

export function dismissUpload(id: string) {
  jobs.delete(id);
  emit();
}

type SignedSlot = { path: string; signedUrl: string };

/**
 * Sends one file and keeps trying with a fresh signed link when a mobile
 * connection drops. Resolves with the stored file path.
 */
export async function startUpload(options: {
  label: string;
  file: File;
  createSlot: () => Promise<SignedSlot>;
}): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  jobs.set(id, {
    id,
    label: options.label,
    percent: 0,
    bytesPerSecond: 0,
    secondsLeft: null,
    status: "uploading",
  });
  emit();

  const update = (patch: Partial<UploadJob>) => {
    const current = jobs.get(id);
    if (!current) return;
    jobs.set(id, { ...current, ...patch });
    emit();
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const slot = await options.createSlot();
      await putWithProgress(slot.signedUrl, options.file, (percent: number, info?: ProgressInfo) =>
        update({
          percent,
          bytesPerSecond: info?.bytesPerSecond ?? 0,
          secondsLeft: info?.secondsLeft ?? null,
        }),
      );
      update({ status: "done", percent: 100, secondsLeft: 0 });
      setTimeout(() => dismissUpload(id), 4000);
      return slot.path;
    } catch (error) {
      lastError = error;
      update({ percent: 0, bytesPerSecond: 0, secondsLeft: null });
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Upload failed.";
  update({ status: "failed", error: message });
  throw new Error(message);
}

/** Warns before a page reload throws away an upload that is still running. */
export function guardUnload() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeunload", (event) => {
    if (activeUploadCount() === 0) return;
    event.preventDefault();
    event.returnValue = "";
  });
}
