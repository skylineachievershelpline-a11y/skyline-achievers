import { useQueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { useRouterState } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { OFFLINE_CACHE_KEY, cacheOwnerId, rememberLastScreen } from "@/lib/offline-cache";

/**
 * Keeps a saved copy of every screen's data on the phone so the app opens and
 * shows the dashboard, team tree, sessions and reports without internet, and
 * shows a small banner while offline.
 */
export function OfflineSupport() {
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Reopening the app returns to the screen the person was last using.
  useEffect(() => {
    rememberLastScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: OFFLINE_CACHE_KEY,
      throttleTime: 800,
    });
    const [unsubscribe] = persistQueryClient({
      queryClient: queryClient as never,
      persister,
      maxAge: 7 * 24 * 3_600_000,
      // A different account on this device never sees another account's saved data.
      buster: cacheOwnerId(),
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" &&
          !String(query.queryKey[0] ?? "").startsWith("admin"),
      },
    });
    return () => unsubscribe();
  }, [queryClient]);


  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!offline) return;
    // Anything that needs the internet (videos, uploads, sending) explains why.
    const onError = (event: PromiseRejectionEvent) => {
      if (String(event.reason?.message ?? "").match(/fetch|network/i)) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onError);
    return () => window.removeEventListener("unhandledrejection", onError);
  }, [offline]);

  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 bottom-3 z-[300] flex justify-center px-3">
      <p className="glass-panel-strong flex items-center gap-2 rounded-full border border-amber-300/40 px-4 py-2 text-[12px] font-semibold text-amber-200 shadow-glass">
        <WifiOff className="h-4 w-4" />
        Offline — viewing saved data. Videos and sending need internet.
      </p>
    </div>
  );
}
