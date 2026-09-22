import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Download, Loader2, Save, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTime12 } from "@/lib/format";
import { DEFAULT_MASTER_SLOTS, type MasterSlot } from "@/lib/journey";
import { getUplineSessionSchedule, saveUplineSessionSchedule } from "@/lib/journey.functions";
import { createMasterSchedulePoster } from "@/lib/journey-poster";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The upline's one master session schedule. Set it once: every new trainee
 * starts on these timings automatically, and the poster can be printed or
 * shared from here.
 */
export function UplineMasterSchedule() {
  const queryClient = useQueryClient();
  const load = useServerFn(getUplineSessionSchedule);
  const persist = useServerFn(saveUplineSessionSchedule);
  const [slots, setSlots] = useState<MasterSlot[]>(DEFAULT_MASTER_SLOTS);
  const [posterBusy, setPosterBusy] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["upline-master-schedule"],
    queryFn: () => load(),
    retry: false,
  });

  useEffect(() => {
    if (data?.slots) setSlots(data.slots as MasterSlot[]);
  }, [data]);

  const save = useMutation({
    mutationFn: () => persist({ data: { slots } } as never),
    onSuccess: () => {
      toast.success("Session schedule saved");
      void queryClient.invalidateQueries({ queryKey: ["upline-master-schedule"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function poster(share: boolean) {
    if (!data) return;
    setPosterBusy(true);
    try {
      const blob = await createMasterSchedulePoster({
        uplineName: data.upline.name,
        uplineCode: data.upline.code,
        slots,
        sessions: data.sessions as any,
      });
      const file = new File([blob], "skyline-session-schedule.png", { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Skyline Achievers session schedule" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPosterBusy(false);
    }
  }

  return (
    <section className="raised-panel metal-edge rounded-3xl p-6 animate-rise-in">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand-glow" />
        <h2 className="font-display text-base font-semibold">Session schedule</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Set the day and time of the 7 basic sessions once. Every new trainee you register starts on
        these timings automatically, and each session stays open for 3 hours. You can change a single
        trainee&apos;s timings later from their Journey window without touching this schedule. All
        timings are Pakistan time.
      </p>

      {isPending ? (
        <div className="mt-5 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {slots.map((slot, index) => (
              <div
                key={slot.session}
                className="inset-panel grid grid-cols-[auto_1fr_1fr] items-end gap-3 rounded-2xl p-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 font-display text-sm font-semibold tabular-nums text-brand-glow">
                  {pad(slot.session)}
                </span>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Day
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={slot.day}
                    onChange={(event) => {
                      const next = [...slots];
                      next[index] = { ...slot, day: Number(event.target.value) || 1 };
                      setSlots(next);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Time ({formatTime12(slot.time)})
                  </Label>
                  <Input
                    type="time"
                    value={slot.time}
                    onChange={(event) => {
                      const next = [...slots];
                      next[index] = { ...slot, time: event.target.value || slot.time };
                      setSlots(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="brand"
            size="xl"
            className="mt-5 w-full rounded-2xl"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save schedule
          </Button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              disabled={posterBusy}
              onClick={() => void poster(false)}
            >
              {posterBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Save poster
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl"
              disabled={posterBusy}
              onClick={() => void poster(true)}
            >
              <Share2 className="h-4 w-4" />
              Share poster
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
