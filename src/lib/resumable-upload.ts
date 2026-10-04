import * as tus from "tus-js-client";

import { putWithProgress, type ProgressHandler } from "@/lib/upload-progress";

/**
 * Resumable, chunked upload for big videos. Sends 6 MB pieces and, when the
 * connection drops, keeps retrying and continues from the last finished piece
 * instead of starting again from zero. Falls back to a single upload if the
 * resumable endpoint is not reachable.
 */
export async function resumableUpload(
  bucket: string,
  path: string,
  signedUrl: string,
  file: File,
  onProgress?: ProgressHandler,
  onReconnect?: (waiting: boolean) => void,
): Promise<void> {
  const token = new URL(signedUrl, window.location.origin).searchParams.get("token");
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!token || !base) return putWithProgress(signedUrl, file, onProgress);

  const startedAt = Date.now();
  let startedBytes = -1;
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable/sign`,
      retryDelays: [0, 2000, 4000, 8000, 15000, 20000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000],
      chunkSize: 6 * 1024 * 1024,
      headers: { "x-signature": token, "x-upsert": "true" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type || "video/mp4",
        cacheControl: "3600",
      },
      onShouldRetry: () => {
        onReconnect?.(true);
        return true;
      },
      onProgress: (sent, total) => {
        onReconnect?.(false);
        if (startedBytes < 0) startedBytes = sent;
        const seconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
        const bytesPerSecond = Math.max(0, sent - startedBytes) / seconds;
        const percent = Math.min(99, Math.round((sent / total) * 100));
        onProgress?.(percent, {
          percent,
          bytesPerSecond,
          secondsLeft: bytesPerSecond > 0 ? Math.round((total - sent) / bytesPerSecond) : null,
        });
      },
      onSuccess: () => {
        onProgress?.(100, { percent: 100, bytesPerSecond: 0, secondsLeft: 0 });
        resolve();
      },
      onError: (error) => reject(new Error(friendly(error))),
    });
    // Continue an earlier unfinished upload of this same file if one exists.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
}

function friendly(error: Error): string {
  const message = error?.message ?? "";
  if (/413|too large|exceeded/i.test(message)) return "This video is too large. Please choose a shorter or smaller video.";
  return "Upload stopped because the internet was lost for too long. Tap Upload again — it will continue from where it stopped.";
}
