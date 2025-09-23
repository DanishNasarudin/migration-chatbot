"use client";

import { formatDistanceToNow } from "date-fns";
import { useState, useTransition } from "react";

import { Sweep } from "@/app/(chat)/api/experiment/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createExperiment,
  deleteExperiment,
  runExistingExperiment,
} from "@/services/experiment";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

type Choices = Awaited<
  ReturnType<typeof import("@/services/experiment").listChoices>
>;
type Item = Awaited<
  ReturnType<typeof import("@/services/experiment").listExperiments>
>[number];

export function ExperimentsTable({
  items,
  choices,
}: {
  items: Item[];
  choices: Choices;
}) {
  const router = useRouter();
  const [openNew, setOpenNew] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  // New experiment form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [datasetFileId, setDatasetFileId] = useState<string>(
    choices.files[0]?.id ?? ""
  );
  const [specId, setSpecId] = useState<string>(choices.specs[0]?.id ?? "");

  const [models, setModels] = useState<string[]>(
    choices.models.map((m) => m.id)
  ); // default: all
  const [promptModes, setPromptModes] = useState<string[]>(choices.promptModes);
  const [unitTool, setUnitTool] = useState<boolean[]>([true, false]);
  const [driftCases, setDriftCases] = useState<(string | null)[]>(
    choices.driftCases
  );

  // Run options
  const [runConcurrency, setRunConcurrency] = useState<number>(2);
  const [runDry, setRunDry] = useState<boolean>(false);

  const toggleFromList = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const submitNew = () => {
    const matrix: Sweep = { models, promptModes, unitTool, driftCases };
    start(async () => {
      const res = await createExperiment({
        name,
        description,
        datasetFileId,
        specId,
        matrix,
      });
      setOpenNew(false);
      setName("");
      setDescription("");
      setToast(`Experiment created: ${res.id}`);
    });
  };

  const runExp = (id: string) => {
    start(async () => {
      const res = await runExistingExperiment(id, {
        concurrency: runConcurrency,
        dryRun: runDry,
      });
      setOpenRun(null);
      setToast(
        `Run complete — combos: ${res.combinations}, trials: ${res.trialsCreated}, validations: ${res.validationRunsCreated}, errors: ${res.errors.length}`
      );
    });
  };

  const deleteExp = (id: string) => {
    start(async () => {
      await deleteExperiment(id);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setOpenNew(true)}>New Experiment</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Dataset</TableHead>
            <TableHead>Spec</TableHead>
            <TableHead className="w-40">Created</TableHead>
            <TableHead className="w-24 text-right">Trials</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.name}</TableCell>
              <TableCell>{e.datasetLabel}</TableCell>
              <TableCell>{e.specLabel}</TableCell>
              <TableCell title={new Date(e.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(e.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {e.trialsCount}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => router.push(`/experiments/${e.id}`)}
                    >
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenRun(e.id)}>
                      Run…
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600">
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete experiment?
                          </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteExp(e.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No experiments yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* New Experiment Dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Experiment</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sweep Q3 A/B"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Dataset</Label>
                <Select value={datasetFileId} onValueChange={setDatasetFileId}>
                  <SelectTrigger id="file">
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.files.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.filename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec">Spec</Label>
                <Select value={specId} onValueChange={setSpecId}>
                  <SelectTrigger id="spec">
                    <SelectValue placeholder="Select spec" />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.specs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Matrix selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="font-medium mb-2">Models</div>
                <div className="grid grid-cols-1 gap-2 max-h-52 overflow-auto pr-2">
                  {choices.models.map((m) => {
                    const checked = models.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setModels((prev) => toggleFromList(prev, m.id))
                          }
                        />
                        <span className="text-sm">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Prompt modes</div>
                <div className="space-y-2">
                  {choices.promptModes.map((pm) => {
                    const checked = promptModes.includes(pm);
                    return (
                      <label key={pm} className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setPromptModes((prev) => toggleFromList(prev, pm))
                          }
                        />
                        <span className="text-sm">{pm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Unit tool</div>
                <div className="space-y-2">
                  {[true, false].map((val) => {
                    const checked = unitTool.includes(val);
                    return (
                      <label
                        key={String(val)}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setUnitTool((prev) => toggleFromList(prev, val))
                          }
                        />
                        <span className="text-sm">{String(val)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Drift cases</div>
                <div className="grid grid-cols-1 gap-2">
                  {choices.driftCases.map((dc) => {
                    const checked = driftCases.includes(dc);
                    return (
                      <label
                        key={String(dc)}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setDriftCases((prev) => toggleFromList(prev, dc))
                          }
                        />
                        <span className="text-sm">{dc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenNew(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitNew}
                disabled={isPending || !name || !datasetFileId || !specId}
              >
                {isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run Config Dialog */}
      <Dialog
        open={!!openRun}
        onOpenChange={(v) => setOpenRun(v ? openRun : null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Run experiment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conc">Concurrency (1–8)</Label>
              <Input
                id="conc"
                type="number"
                min={1}
                max={8}
                value={runConcurrency}
                onChange={(e) =>
                  setRunConcurrency(
                    Math.max(1, Math.min(8, Number(e.target.value)))
                  )
                }
              />
            </div>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={runDry}
                onCheckedChange={() => setRunDry((v) => !v)}
              />
              <span className="text-sm">
                Dry run (validation only, don't persist trials)
              </span>
            </label>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenRun(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => openRun && runExp(openRun)}
                disabled={isPending}
              >
                {isPending ? "Running…" : "Run"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toast && (
        <div
          className="fixed bottom-4 right-4 rounded-md bg-foreground text-background px-3 py-2 text-sm shadow"
          onAnimationEnd={() => setTimeout(() => setToast(null), 2500)}
        >
          {toast}
        </div>
      )}
    </>
  );
}
