"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteRuns, runAgain } from "@/services/experiment";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

type TrialRow =
  import("@/services/experiment").ExperimentDetail["trials"][number];

export function TrialsTable({
  experimentId,
  trials,
}: {
  experimentId: string;
  trials: TrialRow[];
}) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string>("all");
  const [prompt, setPrompt] = useState<string>("all");
  const [drift, setDrift] = useState<string>("all");
  const [unit, setUnit] = useState<string>("all");
  const [passFilter, setPassFilter] = useState<"all" | "passed" | "failed">(
    "all"
  );

  const [openRun, setOpenRun] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [dryRun, setDryRun] = useState(false);
  const [isPending, start] = useTransition();

  const models = useMemo(
    () => Array.from(new Set(trials.map((t) => t.modelId))).sort(),
    [trials]
  );
  const prompts = useMemo(
    () => Array.from(new Set(trials.map((t) => t.promptMode ?? "none"))).sort(),
    [trials]
  );
  const drifts = useMemo(
    () => Array.from(new Set(trials.map((t) => t.driftCase ?? "none"))).sort(),
    [trials]
  );
  const units = useMemo(
    () =>
      Array.from(
        new Set(trials.map((t) => String(t.unitTool) ?? "none"))
      ).sort(),
    [trials]
  );

  const filtered = useMemo(() => {
    return trials.filter((t) => {
      if (q) {
        const s = `${t.modelId} ${t.promptMode ?? ""} ${
          t.driftCase ?? ""
        }`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      if (model !== "all" && t.modelId !== model) return false;
      if (prompt !== "all" && (t.promptMode ?? "none") !== prompt) return false;
      if (drift !== "all" && (t.driftCase ?? "none") !== drift) return false;
      if (unit !== "all" && (String(t.unitTool) ?? "none") !== unit)
        return false;
      if (passFilter === "passed" && !t.passed) return false;
      if (passFilter === "failed" && t.passed) return false;
      return true;
    });
  }, [trials, q, model, prompt, drift, unit, passFilter]);

  const runNow = () => {
    start(async () => {
      const res = await runAgain(experimentId, { concurrency, dryRun });
      setOpenRun(false);
    });
  };

  const deleteExpRuns = () => {
    start(async () => {
      const res = await deleteRuns(experimentId).then(() => {
        toast("Deleted runs");
      });
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3 w-full md:w-auto">
          <div className="space-y-1">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="model / prompt / drift"
            />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Prompt</Label>
            <Select value={prompt} onValueChange={setPrompt}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {prompts.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Drift</Label>
            <Select value={drift} onValueChange={setDrift}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {drifts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unit</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {units.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Select
            value={passFilter}
            onValueChange={(v: any) => setPassFilter(v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={"outline"}
            className="text-destructive"
            onClick={() => deleteExpRuns()}
            disabled={isPending || filtered.length === 0}
          >
            Delete Runs
          </Button>
          {/* <Button onClick={() => setOpenRun(true)} disabled={isPending}>
            Run again…
          </Button> */}
        </div>
      </div>

      <div className="rounded-lg border mt-4 max-h-[600px] overflow-hidden overflow-y-auto relative">
        <Table noWrapper>
          <TableHeader className="sticky top-0 z-10 bg-background border-b-[1px] border-border">
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead className="w-24">Unit</TableHead>
              <TableHead>Drift</TableHead>
              <TableHead className="w-20">Passed</TableHead>
              <TableHead className="w-24">P</TableHead>
              <TableHead className="w-24">R</TableHead>
              <TableHead className="w-24">F1</TableHead>
              <TableHead className="w-24">Type Acc</TableHead>
              <TableHead className="w-28">Valid Rows %</TableHead>
              <TableHead className="w-20">Issues</TableHead>
              {/* <TableHead className="w-44">Created</TableHead> */}
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.modelId}</TableCell>
                <TableCell>{t.promptMode ?? "—"}</TableCell>
                <TableCell>{String(t.unitTool)}</TableCell>
                <TableCell>{t.driftCase ?? "none"}</TableCell>
                <TableCell>
                  {t.passed ? (
                    <Badge variant="secondary">yes</Badge>
                  ) : (
                    <Badge variant="destructive">no</Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.precision?.toFixed(3) ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.recall?.toFixed(3) ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.f1?.toFixed(3) ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.typeAcc?.toFixed(3) ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {/* {t.validRows != null && t.totalRows != null
                    ? `${t.validRows}/${t.totalRows}`
                    : "—"} */}
                  {t.validRowsPct
                    ? `${(100 * t.validRowsPct!).toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{t.issuesCount}</TableCell>
                {/* <TableCell title={new Date(t.createdAt).toLocaleString()}>
                  {formatDistanceToNow(new Date(t.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell> */}
                <TableCell>
                  <Link
                    href={`/validation/${t.validationRunId}`}
                    className="text-sm underline underline-offset-2"
                  >
                    Open run →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground"
                >
                  No trials match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Run again dialog */}
      <Dialog open={openRun} onOpenChange={setOpenRun}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Run experiment again</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conc">Concurrency (1–8)</Label>
              <Input
                id="conc"
                type="number"
                min={1}
                max={8}
                value={concurrency}
                onChange={(e) =>
                  setConcurrency(
                    Math.max(1, Math.min(8, Number(e.target.value)))
                  )
                }
              />
            </div>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={dryRun}
                onCheckedChange={() => setDryRun((v) => !v)}
              />
              <span className="text-sm">
                Dry run (validation only, don’t persist trials)
              </span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenRun(false)}>
                Cancel
              </Button>
              <Button onClick={runNow} disabled={isPending}>
                {isPending ? "Running…" : "Run"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
