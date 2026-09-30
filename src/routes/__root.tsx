import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OfflineSupport } from "@/components/OfflineSupport";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "../components/ui/sonner";
import { UploadDock } from "../components/UploadDock";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isPreviewContext } from "../lib/pwa-install";
import { MotionController } from "../components/motion/MotionController";
import { LiquidAtmosphere } from "../components/motion/LiquidAtmosphere";
import { THEME_BOOTSTRAP_SCRIPT } from "../lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-cyan/30 brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand transition-transform hover:-translate-y-0.5"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Skyline Achievers Training" },
      {
        name: "description",
        content:
          "Private member training platform for Skyline Achievers: rank-based training videos and resources.",
      },
      { name: "author", content: "Skyline Achievers" },
      { property: "og:title", content: "Skyline Achievers Training" },
      {
        property: "og:description",
        content: "Private member training platform for Skyline Achievers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#07090f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Skyline Achievers" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/app-icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Applies the saved look before the first paint so nothing flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Register the service worker so the site can be installed as an app.
  // Never in the editor preview / iframe: browsers block install there and
  // stale caches would keep serving old builds.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (isPreviewContext() || !import.meta.env.PROD) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          if (registration.active?.scriptURL.endsWith("/sw.js")) void registration.unregister();
        });
      });
      return;
    }
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* installability is optional; ignore registration failures */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  // The admin area installs as its own "Skyline Admin" app.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const href = pathname.startsWith("/admin") ? "/admin-manifest.webmanifest" : "/manifest.webmanifest";
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <LiquidAtmosphere />
      <MotionController />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <UploadDock />
      <OfflineSupport />
      <Toaster />
    </QueryClientProvider>
  );
}

