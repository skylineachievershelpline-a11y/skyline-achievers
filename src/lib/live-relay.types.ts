/** Browser-safe shapes of events sent by the live relay. */
export type WhiteboardData = {
  title: string;
  items: { icon: string | null; text: string }[];
  flow: string[];
  chart: { caption: string; bars: { label: string; value: number }[] } | null;
};
