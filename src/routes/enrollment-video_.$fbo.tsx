import { createFileRoute } from "@tanstack/react-router";

import { EnrollmentVideoView, enrollmentHead, loadEnrollment } from "@/components/landing/EnrollmentVideoView";

export const Route = createFileRoute("/enrollment-video_/$fbo")({
  loader: ({ params }) => loadEnrollment(params.fbo),
  head: ({ loaderData }) => enrollmentHead(loaderData),
  component: () => <EnrollmentVideoView {...Route.useLoaderData()} />,
});
