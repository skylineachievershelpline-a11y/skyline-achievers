/**
 * Renders whatever the admin attached to an announcement: a voice message, a
 * picture or a video. Signed links come from the server.
 */
export function NotificationMedia({
  mediaType,
  mediaUrl,
}: {
  mediaType?: string | null;
  mediaUrl?: string | null;
}) {
  if (!mediaType || !mediaUrl) return null;

  if (mediaType === "audio") {
    return (
      <div className="mt-2 rounded-2xl border border-hairline bg-glass p-2">
        <audio src={mediaUrl} controls preload="none" className="w-full" />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        controls
        playsInline
        preload="metadata"
        className="mt-2 w-full rounded-2xl border border-hairline"
      />
    );
  }

  return (
    <img
      src={mediaUrl}
      alt="Announcement"
      loading="lazy"
      className="mt-2 w-full rounded-2xl border border-hairline object-cover"
    />
  );
}
