"use client";

import {
  cancelExperimentRun,
  getActiveRuns,
  getRunStatus,
} from "@/services/experiment";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";

type Active = {
  runId: string;
  experimentId: string;
  total: number;
  baseline: number;
  done: number;
};

const LS_KEY = "activeExperimentRuns"; // { [runId]: { experimentId } }

function loadLS(): Record<string, { experimentId: string }> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveLS(v: Record<string, { experimentId: string }>) {
  localStorage.setItem(LS_KEY, JSON.stringify(v));
}

export function ExperimentRunToasts() {
  const stateRef = React.useRef<Record<string, number>>({}); // toastId by runId

  // hydrator: on mount, fetch any active runs from DB, merge with LS, and start polling
  React.useEffect(() => {
    let cancelled = false;

    async function mount() {
      const fromDB = await getActiveRuns(); // server action
      const ls = loadLS();

      // union of both sources
      const merged: Record<string, { experimentId: string }> = { ...ls };
      for (const r of fromDB) merged[r.id] = { experimentId: r.experimentId };
      saveLS(merged);

      // show/update a toast per active run and start polling
      for (const runId of Object.keys(merged)) {
        openOrUpdate(runId);
      }
    }

    async function openOrUpdate(runId: string) {
      if (cancelled) return;

      // create the toast if not present
      if (!stateRef.current[runId]) {
        const id = toast.custom(
          (t) => (
            <RunToastContent
              runId={runId}
              onCancel={async () => {
                toast.loading("Cancelling…", { id: stateRef.current[runId] });
                await cancelExperimentRun(runId);
              }}
            />
          ),
          { duration: Infinity }
        );
        stateRef.current[runId] = id as unknown as number;
      }

      // start poll loop per run
      poll(runId);
    }

    async function poll(runId: string) {
      while (!cancelled) {
        const s = await getRunStatus(runId);
        if ((s as any).missing) {
          // unknown - clear
          clear(runId);
          break;
        }
        const total = s.total;
        const progress = Math.max(0, s.done!! - s.baseline!!);
        toast.custom(
          (t) => (
            <RunToastContent
              runId={runId}
              progress={`${progress}/${total}`}
              status={s.status}
              onCancel={async () => {
                toast.loading("Cancelling…", { id: stateRef.current[runId] });
                await cancelExperimentRun(runId);
              }}
            />
          ),
          { id: stateRef.current[runId], duration: Infinity }
        );

        if (s.status !== "RUNNING") {
          // finalize
          if (s.status === "DONE")
            toast.success(`Run complete — ${progress}/${total}`, {
              id: stateRef.current[runId],
              duration: 2500,
            });
          else if (s.status === "CANCELLED")
            toast(`Run cancelled — ${progress}/${total}`, {
              id: stateRef.current[runId],
              duration: 2500,
            });
          else
            toast.error(`Run failed: ${s.error ?? "unknown"}`, {
              id: stateRef.current[runId],
              duration: 10000,
            });
          clear(runId);
          break;
        }

        await new Promise((r) => setTimeout(r, 10000));
      }
    }

    function clear(runId: string) {
      delete stateRef.current[runId];
      const ls = loadLS();
      delete ls[runId];
      saveLS(ls);
    }

    mount();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function RunToastContent(props: {
  runId: string;
  progress?: string;
  status?: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-background border border-border rounded-lg p-4">
      <div className="flex flex-col">
        <div className="font-medium">Experiment running…</div>
        <div className="text-xs text-muted-foreground">
          {props.status ?? "RUNNING"}{" "}
          {props.progress ? ` · ${props.progress}` : null}
        </div>
      </div>
      <div className="ml-auto flex gap-2">
        {props.status === "RUNNING" && (
          <Button variant={"outline"} size={"sm"} onClick={props.onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
