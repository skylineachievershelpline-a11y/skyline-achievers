/** Browser upload helper that reports live progress while the file is sent. */
export type ProgressHandler = (percent: number) => void;

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
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
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
