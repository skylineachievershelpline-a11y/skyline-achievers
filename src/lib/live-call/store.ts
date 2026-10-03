/** Opens the Skyline AI call screen from anywhere in the app. */
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function openLiveCall() {
  open = true;
  listeners.forEach((fn) => fn());
}

export function closeLiveCall() {
  open = false;
  listeners.forEach((fn) => fn());
}

export function useLiveCallOpen() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => false,
  );
}
