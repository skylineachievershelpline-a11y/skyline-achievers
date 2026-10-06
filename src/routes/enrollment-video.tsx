import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentVideoView, enrollmentHead, loadEnrollment } from "@/components/landing/EnrollmentVideoView";

export const Route = createFileRoute("/enrollment-video")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search["fbo"];
    return { fbo: raw === undefined || raw === null ? undefined : String(raw) };
  },
  loaderDeps: ({ search }) => ({ fbo: search.fbo }),
  loader: ({ deps }) => loadEnrollment(deps.fbo),
  head: ({ loaderData }) => enrollmentHead(loaderData),
  component: () => <EnrollmentVideoView {...Route.useLoaderData()} />,
});
