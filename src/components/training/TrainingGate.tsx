/** Mandatory training lock for the member area. */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMyTraining } from "@/lib/training.functions";

export function useMyTraining() {
  const load = useServerFn(getMyTraining);
  return useQuery({ queryKey: ["my-training"], queryFn: () => load(), retry: 1, staleTime: 30_000 });
}

export function useTrainingLock() {
  const { data } = useMyTraining();
  return Boolean(data?.locked);
}

export function TrainingLockScreen() {
  return (
    <div className="raised-panel metal-edge mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
      <GraduationCap className="mx-auto h-8 w-8 text-cyan" />
      <h1 className="mt-4 font-display text-lg font-semibold">Aapki mandatory training abhi complete nahi hui.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pehle Skyline AI Teacher ke sath training complete karein.</p>
      <Button asChild variant="brand" size="xl" className="mt-6 w-full rounded-2xl">
        <Link to="/training-room">Start Training with Skyline AI</Link>
      </Button>
    </div>
  );
}
