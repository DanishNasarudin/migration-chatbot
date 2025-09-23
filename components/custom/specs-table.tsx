"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState, useTransition } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteSpec, getSpecSummary } from "@/services/spec";
import { MoreHorizontal } from "lucide-react";

type SpecRow = {
  id: string;
  name: string;
  version: string;
  domain: string;
  status: string;
  updatedAt: string; // ISO
};

type Summary = null | {
  id: string;
  name: string;
  version: string;
  domain: string;
  status: string;
  updatedAt: string;
  fieldCount: number;
  primaryKeys: string[];
  uniquesCount: number;
  previewFields: Array<{
    name: string;
    type: string;
    nullable: boolean;
    unit?: string;
  }>;
};

export function SpecsTable({ items }: { items: SpecRow[] }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>(null);
  const [isPending, start] = useTransition();

  const handleViewSummary = (id: string) => {
    start(async () => {
      const s = await getSpecSummary(id);
      setSummary(s);
      setOpen(true);
    });
  };

  const handleDelete = (id: string) => {
    start(async () => {
      await deleteSpec(id);
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Version</TableHead>
            <TableHead className="w-32">Domain</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-48">Updated</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.version}</TableCell>
              <TableCell>{s.domain}</TableCell>
              <TableCell>{s.status}</TableCell>
              <TableCell title={new Date(s.updatedAt).toLocaleString()}>
                {formatDistanceToNow(new Date(s.updatedAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleViewSummary(s.id)}>
                      View summary
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600">
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete spec?</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleDelete(s.id)}
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
                No specs yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {summary
                ? `${summary.name} · ${summary.version}`
                : "Spec summary"}
            </DialogTitle>
          </DialogHeader>

          {isPending && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          {summary && !isPending && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Domain:</span>{" "}
                  {summary.domain}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {summary.status}
                </div>
                <div>
                  <span className="text-muted-foreground">Fields:</span>{" "}
                  {summary.fieldCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Primary keys:</span>{" "}
                  {summary.primaryKeys.join(", ") || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Unique sets:</span>{" "}
                  {summary.uniquesCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>{" "}
                  {new Date(summary.updatedAt).toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-24">Nullable</TableHead>
                      <TableHead>Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.previewFields.map((f) => (
                      <TableRow key={f.name}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell>{f.type}</TableCell>
                        <TableCell>{f.nullable ? "true" : "false"}</TableCell>
                        <TableCell>{f.unit ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Link
                  href={`/specs/${summary.id}`}
                  className="text-sm underline underline-offset-2"
                >
                  Open full details →
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
