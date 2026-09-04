import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Copy, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uplineCreateFinalTest, uplineFinalTests } from "@/lib/finaltest.functions";

export const Route = createFileRoute("/final-test")({
  head: () => ({
    meta: [
      { title: "Final Test — Skyline Achievers" },
      {
        name: "description",
        content:
          "Generate a Final Test link for a person and view their Final Test record on Skyline Achievers.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Final Test — Skyline Achievers" },
      {
        property: "og:description",
        content: "Generate and view Final Test records for your team.",
      },
    ],
  }),
  component: FinalTestPage,
});

type TestRow = {
  id: string;
  token: string;
  person_name: string;
  mobile: string;
  upline_name: string;
  status: string;
  marks: number | null;
  result: string;
};

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function testLinkFor(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/test/${token}`;
}

function FinalTestPage() {
  const ready = useMemberGuard();
  const queryClient = useQueryClient();
  const createTest = useServerFn(uplineCreateFinalTest);
  const loadTests = useServerFn(uplineFinalTests);

  const [personName, setPersonName] = useState("");
  const [mobile, setMobile] = useState("");
  const [generated, setGenerated] = useState<TestRow | null>(null);

  const list = useQuery({
    queryKey: ["upline-final-tests"],
    queryFn: () => loadTests(),
    enabled: ready,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => createTest({ data: { personName: personName.trim(), mobile: mobile.trim() } }),
    onSuccess: (data: any) => {
      setGenerated(data.test as TestRow);
      setPersonName("");
      setMobile("");
      void queryClient.invalidateQueries({ queryKey: ["upline-final-tests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(testLinkFor(token));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.");
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const tests = ((list.data as any)?.tests ?? []) as TestRow[];

  return (
    <MemberShell title="Final Test" subtitle="Generate a test link and view records">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-panel-strong animate-rise-in rounded-3xl p-6">
          <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Generate link
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personName">Person name</Label>
              <Input
                id="personName"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Full name"
                className="h-12 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile number</Label>
              <Input
                id="mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                inputMode="tel"
                placeholder="03xxxxxxxxx"
                className="h-12 rounded-2xl"
              />
            </div>

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={create.isPending}
              onClick={() => {
                if (personName.trim().length < 2 || mobile.trim().length < 7) {
                  toast.error("Enter the person's name and mobile number.");
                  return;
                }
                create.mutate();
              }}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Generate link
            </Button>
          </div>

          {generated ? (
            <div className="mt-5 rounded-2xl border border-hairline bg-surface-2 p-4 animate-rise-in">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Test link for {generated.person_name}
              </p>
              <p className="mt-2 break-all text-sm text-foreground">
                {testLinkFor(generated.token)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 rounded-2xl"
                onClick={() => void copy(generated.token)}
              >
                <Copy className="h-4 w-4" /> Copy link
              </Button>
            </div>
          ) : null}
        </section>

        <section className="animate-rise-in" style={{ animationDelay: "80ms" }}>
          <h2 className="mb-3 font-display text-lg font-semibold">Final Test records</h2>
          {list.isPending ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : tests.length === 0 ? (
            <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
              No Final Test links generated yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {tests.map((row) => (
                <li key={row.id} className="glass-panel rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.person_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.mobile} · Upline {row.upline_name}
                      </p>
                    </div>
                    <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>Marks: {row.marks ?? "—"}</span>
                    <span>Result: {row.result === "pending" ? "Pending" : row.result.toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={() => void copy(row.token)}
                      className="ml-auto inline-flex items-center gap-1 text-brand transition-opacity hover:opacity-80"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy link
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Records are view only. Marks and results are set by the admin.
          </p>
        </section>
      </div>
    </MemberShell>
  );
}
