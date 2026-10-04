import type { PerformanceAnalysis } from "@/lib/performance-trend";

/** The same day-by-day activities displayed in the monthly report PDF. */
export function MonthlyActivityChart({ analysis }: { analysis: PerformanceAnalysis }) {
  const points = analysis.series;
  if (!points.length) return <p className="py-8 text-center text-sm text-muted-foreground">Is month ka report data nahi mila.</p>;

  const max = Math.max(1, ...points.map((day) => day.activity));
  const width = 720;
  const height = 190;
  const left = 32;
  const right = 16;
  const top = 18;
  const bottom = 26;
  const baseline = height - bottom;
  const x = (index: number) => left + index * (width - left - right) / Math.max(points.length - 1, 1);
  const y = (activity: number) => baseline - (activity / max) * (baseline - top);
  const coordinates = points.map((day, index) => `${x(index)},${y(day.activity)}`).join(" ");
  const area = `${left},${baseline} ${coordinates} ${x(points.length - 1)},${baseline}`;
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor((points.length - 1) * 3 / 4), points.length - 1])];

  return (
    <div className="mt-4 rounded-md border border-hairline bg-surface/60 px-2 py-4 sm:px-4">
      <div className="flex items-center justify-between gap-3 px-2 text-xs">
        <span className="font-semibold text-foreground">Daily activity</span>
        <span className="text-muted-foreground">Leads + Responses + Enrollments</span>
      </div>
      <svg className="mt-3 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily activity chart: ${points.map((day) => `${day.date}: ${day.activity}`).join(", ")}`}>
        <defs>
          <linearGradient id="monthly-activity-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.48" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="monthly-activity-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}>
          <line x1={left} x2={width - right} y1={y(max * fraction)} y2={y(max * fraction)} stroke="var(--border)" strokeOpacity="0.7" strokeDasharray="3 5" />
          <text x={left - 7} y={y(max * fraction) + 3} fill="var(--muted-foreground)" fontSize="10" textAnchor="end">{Math.round(max * fraction)}</text>
        </g>)}
        <polygon points={area} fill="url(#monthly-activity-fill)" />
        <polyline points={coordinates} fill="none" stroke="url(#monthly-activity-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.filter((day) => day.activity > 0).map((day) => {
          const index = points.indexOf(day);
          return <circle key={day.date} cx={x(index)} cy={y(day.activity)} r="3" fill="var(--cyan)"><title>{day.date}: {day.activity} activities</title></circle>;
        })}
        {ticks.map((index) => <text key={index} x={x(index)} y={height - 4} fill="var(--muted-foreground)" fontSize="10" textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{Number(points[index]?.date.slice(-2))}</text>)}
      </svg>
      <div className="flex justify-between px-2 text-[11px] text-muted-foreground"><span>{points[0]?.date.slice(-2)} {points[0]?.date.slice(5, 7)}</span><span>{points[points.length - 1]?.date.slice(-2)} {points[points.length - 1]?.date.slice(5, 7)}</span></div>
    </div>
  );
}