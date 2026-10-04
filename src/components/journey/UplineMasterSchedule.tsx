import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Download, Loader2, Printer, Save, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { playPrinterSound } from "@/components/courses/PaymentSlip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime12 } from "@/lib/format";
import { DEFAULT_MASTER_SLOTS, type MasterSlot } from "@/lib/journey";
import { getUplineSessionSchedule, saveUplineSessionSchedule } from "@/lib/journey.functions";
import { createMasterSchedulePoster } from "@/lib/journey-poster";

const pad = (value: number) => String(value).padStart(2, "0");

const CLOCK_TIMES = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${pad(hour)}:${minute}`;
});

/**
 * The upline's one master session schedule, shown as two top buttons: one opens
 * the schedule editor, the other prints the branded schedule poster.
 * Set it once: every new trainee starts on these timings automatically.
 */
export function UplineMasterSchedule() {
  const queryClient = useQueryClient();
  const load = useServerFn(getUplineSessionSchedule);
  const persist = useServerFn(saveUplineSessionSchedule);
  const [slots, setSlots] = useState<MasterSlot[]>(DEFAULT_MASTER_SLOTS);
  const [view, setView] = useState<"none" | "schedule" | "poster">("none");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
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
      setView("none");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function printPoster() {
    if (!data) return;
    setPosterBusy(true);
    try {
      const blob = await createMasterSchedulePoster({
        uplineName: data.upline.name,
        uplineCode: data.upline.code,
        slots,
        sessions: data.sessions as any,
      });
      setPosterBlob(blob);
      setPosterUrl(URL.createObjectURL(blob));
      setView("poster");
      playPrinterSound();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPosterBusy(false);
    }
  }

  function savePoster() {
    if (!posterBlob) return;
    const url = URL.createObjectURL(posterBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "skyline-session-schedule.png";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Schedule poster saved");
  }

  async function sharePoster() {
    if (!posterBlob) return;
    const file = new File([posterBlob], "skyline-session-schedule.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Skyline Achievers session schedule" });
      } catch {
        /* the member closed the share sheet */
      }
      return;
    }
    savePoster();
  }

  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <Button
          variant="brand"
          size="xl"
          className="rounded-2xl"
          onClick={() => setView("schedule")}
        >
          <CalendarClock className="h-4 w-4" />
          Session schedule
        </Button>
        <Button
          variant="outline"
          size="xl"
          className="rounded-2xl"
          disabled={posterBusy || isPending}
          onClick={() => void printPoster()}
        >
          {posterBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Print schedule poster
        </Button>
      </div>

      {view === "schedule" ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-sm">
          <section className="raised-panel metal-edge my-6 w-full max-w-lg rounded-3xl p-6">
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-1 h-4 w-4 shrink-0 text-brand-glow" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-semibold">Session schedule</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set the day and time of the 7 basic sessions once. Every new trainee you register
                  starts on these timings automatically and each session stays open for 3 hours. A
                  single trainee&apos;s timings can still be changed from their Journey window. All
                  timings are Pakistan time.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setView("none")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isPending ? (
              <div className="mt-5 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={Math.max(...slots.map((s) => s.day)) <= 4 ? "brand" : "outline"}
                    className="rounded-2xl"
                    onClick={() => setSlots(DEFAULT_MASTER_SLOTS.map((s) => ({ ...s })))}
                  >
                    4 Days Training
                  </Button>
                  <Button
                    type="button"
                    variant={Math.max(...slots.map((s) => s.day)) === 7 ? "brand" : "outline"}
                    className="rounded-2xl"
                    onClick={() => setSlots(slots.map((s) => ({ ...s, day: s.session, time: "20:00" })))}
                  >
                    7 Days Training
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Plan chunein, phir har session ka din aur time apni marzi se badlein — ek din mein kai sessions bhi rakh sakte hain.
                  Agar trainee pichla session jaldi complete aur approve karwa le, to agla session apne set time par pehle hi khul jata hai.
                </p>
                <div className="mt-4 space-y-3">
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
                           Time
                         </Label>
                         <Select
                          value={slot.time}
                           onValueChange={(value) => {
                            const next = [...slots];
                             next[index] = { ...slot, time: value };
                            setSlots(next);
                          }}
                         >
                           <SelectTrigger aria-label={`Session ${slot.session} time`}>
                             <SelectValue>{formatTime12(slot.time)}</SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                             {CLOCK_TIMES.map((time) => (
                               <SelectItem key={time} value={time}>
                                 {formatTime12(time)}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
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
              </>
            )}
          </section>
        </div>
      ) : null}

      {view === "poster" && posterUrl ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/90 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-sm">
            <div className="schedule-poster-machine">
              <div className="slip-printer" aria-hidden>
                <span className="slip-printer-cap" />
                <span className="slip-printer-slot" />
                <span className="slip-printer-led" />
              </div>
              <div className="schedule-poster-window">
                <img
                  src={posterUrl}
                  alt="Skyline Achievers session schedule poster"
                  className="schedule-poster-paper w-full"
                />
              </div>
            </div>
            <div className="schedule-poster-actions mt-3 grid grid-cols-3 gap-2">
              <Button variant="brand" className="rounded-2xl" onClick={savePoster}>
                <Download className="h-4 w-4" />
                Save
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => void sharePoster()}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => setView("none")}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
