/** Browser upload helper that reports live progress while the file is sent. */
export type ProgressInfo = {
  percent: number;
  bytesPerSecond: number;
  secondsLeft: number | null;
};

export type ProgressHandler = (percent: number, info?: ProgressInfo) => void;

export function putWithProgress(
  signedUrl: string,
  file: File | Blob,
  onProgress?: ProgressHandler,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    const type = (file as File).type;
    xhr.setRequestHeader("content-type", type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");

    const startedAt = Date.now();
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const seconds = Math.max(0.001, (Date.now() - startedAt) / 1000);
      const bytesPerSecond = event.loaded / seconds;
      const remainingBytes = Math.max(0, event.total - event.loaded);
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)), {
        percent: Math.min(99, Math.round((event.loaded / event.total) * 100)),
        bytesPerSecond,
        secondsLeft: bytesPerSecond > 0 ? Math.round(remainingBytes / bytesPerSecond) : null,
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100, { percent: 100, bytesPerSecond: 0, secondsLeft: 0 });
        resolve();
        return;
      }
      reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}
