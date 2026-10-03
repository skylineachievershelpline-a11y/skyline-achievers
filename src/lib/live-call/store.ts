/** Opens the Skyline AI call screen (normal call or training class) from anywhere. */
import { useSyncExternalStore } from "react";

type CallState = { open: boolean; training: boolean };
let state: CallState = { open: false, training: false };
const listeners = new Set<() => void>();

function set(next: CallState) {
  state = next;
  listeners.forEach((fn) => fn());
}

export function openLiveCall(options: { training?: boolean } = {}) {
  set({ open: true, training: Boolean(options.training) });
}

export function closeLiveCall() {
  set({ open: false, training: state.training });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLiveCallOpen() {
  return useSyncExternalStore(subscribe, () => state.open, () => false);
}

export function useLiveCallTraining() {
  return useSyncExternalStore(subscribe, () => state.training, () => false);
}
