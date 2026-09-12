import { putWithProgress, type ProgressHandler } from "@/lib/upload-progress";

type Bucket = "training-videos" | "training-resources" | "training-thumbnails";

export type CreateUploadUrl = (opts: {
  data: { bucket: Bucket; fileName: string };
}) => Promise<{ path: string; token: string; signedUrl: string }>;

/**
 * Files go straight from the browser into the private bucket using a
 * short-lived signed upload URL minted by the admin server function.
 * `onProgress` reports how much of the file has been sent (0-100).
 * A dropped mobile connection is retried automatically with a fresh URL
 * instead of failing the whole form.
 */
export async function uploadToBucket(
  createUrl: CreateUploadUrl,
  bucket: Bucket,
  file: File,
  onProgress?: ProgressHandler,
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const signed = await createUrl({ data: { bucket, fileName: file.name } });
      await putWithProgress(signed.signedUrl, file, onProgress);
      return signed.path;
    } catch (error) {
      lastError = error;
      onProgress?.(0);
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed. Please try again.");
}

/** Reads a video file's length in the browser so live sessions know when to end. */
export async function videoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    video.onerror = () => done(null);
  });
}
