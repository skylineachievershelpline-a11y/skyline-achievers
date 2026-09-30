import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { hydrateSavedScreens } from "./lib/offline-cache";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Screens open from the saved copy first and refresh quietly behind it,
        // so moving around the app never waits for the internet.
        staleTime: 60_000,
        gcTime: 24 * 3_600_000,
        refetchOnWindowFocus: false,
        refetchOnMount: "always",
        networkMode: "offlineFirst",
        retry: 1,
      },
    },
  });

  // Everything the person saw last time is back in memory before the first
  // screen paints.
  hydrateSavedScreens(queryClient);


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
