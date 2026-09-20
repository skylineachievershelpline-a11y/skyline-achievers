import { BadgeCheck } from "lucide-react";

import { formatRankName, RankPin } from "@/components/member/RankPin";
import { BRAND } from "@/lib/brand";

export type ReelAuthorInfo = {
  authorName: string;
  verified: boolean;
  authorAvatarUrl?: string | null;
  authorRank?: string | null;
};

/**
 * Who posted the reel: their own profile picture, full name and the same rank
 * pin that appears on their dashboard. Official clips show the Skyline mark.
 */
export function ReelAuthor({ reel }: { reel: ReelAuthorInfo }) {
  return (
    <div className="flex items-center gap-2">
      {reel.verified ? (
        <img
          src={BRAND.logoUrl}
          alt=""
          className="h-9 w-9 rounded-full border border-cyan/40 bg-surface-2 object-contain p-0.5"
        />
      ) : reel.authorAvatarUrl ? (
        <img
          src={reel.authorAvatarUrl}
          alt=""
          className="h-9 w-9 rounded-full border border-cyan/40 bg-surface-2 object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface-2 text-[11px] font-semibold">
          {reel.authorName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate text-xs font-semibold">{reel.authorName}</span>
      {reel.verified ? (
        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Verified" />
      ) : reel.authorRank ? (
        <RankPin rank={reel.authorRank} className="h-8 w-8" />
      ) : null}
    </div>
  );
}
