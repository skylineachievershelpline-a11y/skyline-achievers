/**
 * Temporary on-screen pointers drawn by Skyline AI during a call.
 * Purely visual: it never changes or clicks anything on the website.
 */
import { useEffect, useState } from "react";

import { CALL_UI_ATTR, findLiveElement } from "@/lib/live-call/screen";

export type LiveMark = {
  key: string;
  tool: "arrow" | "circle" | "rect" | "spotlight" | "pointer" | "number";
  element_id: string | null;
  box: { x: number; y: number; w: number; h: number } | null;
  number: number | null;
  label: string | null;
};

type Placed = LiveMark & { r: { x: number; y: number; w: number; h: number } };

function place(marks: LiveMark[]): Placed[] {
  const out: Placed[] = [];
  for (const m of marks) {
    if (m.element_id) {
      const el = findLiveElement(m.element_id);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      out.push({ ...m, r: { x: b.left, y: b.top, w: b.width, h: b.height } });
    } else if (m.box) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      out.push({ ...m, r: { x: m.box.x * W, y: m.box.y * H, w: m.box.w * W, h: m.box.h * H } });
    }
  }
  return out;
}

export function LiveAnnotations({ marks }: { marks: LiveMark[] }) {
  const [placed, setPlaced] = useState<Placed[]>([]);

  // Follow the elements while the user scrolls or the layout moves.
  useEffect(() => {
    if (!marks.length) {
      setPlaced([]);
      return;
    }
    let raf = 0;
    const loop = () => {
      setPlaced(place(marks));
      raf = window.setTimeout(() => requestAnimationFrame(loop), 120) as unknown as number;
    };
    loop();
    return () => window.clearTimeout(raf);
  }, [marks]);

  if (!placed.length) return null;
  const W = typeof window === "undefined" ? 0 : window.innerWidth;
  const H = typeof window === "undefined" ? 0 : window.innerHeight;
  const spot = placed.find((p) => p.tool === "spotlight");

  return (
    <svg
      {...{ [CALL_UI_ATTR]: "" }}
      className="live-annotations pointer-events-none fixed inset-0 z-[93] h-full w-full"
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
    >
      <defs>
        <marker id="live-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" className="fill-cyan" />
        </marker>
        {spot ? (
          <mask id="live-spot-mask">
            <rect x="0" y="0" width={W} height={H} fill="white" />
            <rect x={spot.r.x - 10} y={spot.r.y - 10} width={spot.r.w + 20} height={spot.r.h + 20} rx="14" fill="black" />
          </mask>
        ) : null}
      </defs>
      {spot ? <rect x="0" y="0" width={W} height={H} className="fill-background/70" mask="url(#live-spot-mask)" /> : null}
      {placed.map((p) => {
        const { x, y, w, h } = p.r;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const label = p.label ? (
          <g>
            <rect x={Math.min(Math.max(x, 8), W - 160)} y={Math.max(y - 34, 6)} width={Math.min(150, p.label.length * 8 + 20)} height="26" rx="13" className="fill-cyan" />
            <text x={Math.min(Math.max(x, 8), W - 160) + 10} y={Math.max(y - 34, 6) + 17} className="fill-primary-foreground text-[12px] font-bold">
              {p.label}
            </text>
          </g>
        ) : null;
        if (p.tool === "circle") {
          return (
            <g key={p.key} className="live-mark">
              <ellipse cx={cx} cy={cy} rx={w / 2 + 14} ry={h / 2 + 12} className="fill-none stroke-cyan" strokeWidth="3.5" />
              {label}
            </g>
          );
        }
        if (p.tool === "rect" || p.tool === "spotlight") {
          return (
            <g key={p.key} className="live-mark">
              <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx="12" className="fill-none stroke-cyan" strokeWidth="3" />
              {label}
            </g>
          );
        }
        if (p.tool === "arrow") {
          const fromX = cx > W / 2 ? Math.max(x - 90, 12) : Math.min(x + w + 90, W - 12);
          const fromY = cy > H / 2 ? Math.max(y - 90, 12) : Math.min(y + h + 90, H - 12);
          const toX = fromX < cx ? x - 4 : x + w + 4;
          const toY = fromY < cy ? y - 4 : y + h + 4;
          return (
            <g key={p.key} className="live-mark">
              <line x1={fromX} y1={fromY} x2={toX} y2={toY} className="stroke-cyan" strokeWidth="4" strokeLinecap="round" markerEnd="url(#live-arrow-head)" />
              {label}
            </g>
          );
        }
        if (p.tool === "pointer") {
          return (
            <g key={p.key} className="live-mark">
              <circle cx={cx} cy={cy} r="22" className="live-pointer-ring fill-cyan/20 stroke-cyan" strokeWidth="2" />
              <circle cx={cx} cy={cy} r="7" className="fill-cyan" />
              {label}
            </g>
          );
        }
        return (
          <g key={p.key} className="live-mark">
            <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx="10" className="fill-none stroke-cyan" strokeWidth="2" strokeDasharray="6 5" />
            <circle cx={Math.max(x - 4, 16)} cy={Math.max(y - 4, 16)} r="14" className="fill-cyan" />
            <text x={Math.max(x - 4, 16)} y={Math.max(y - 4, 16) + 5} textAnchor="middle" className="fill-primary-foreground text-[14px] font-bold">
              {p.number ?? 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
