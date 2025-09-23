"use client";

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
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useTransition } from "react";

import { deleteValidationRun } from "@/services/validate-run";
import { MoreHorizontal } from "lucide-react";

type Item = {
  id: string;
  createdAt: string; // ISO
  passed: boolean;
  unitTool: boolean;
  datasetFile: { filename: string } | null;
  spec: { id: string; name: string; version: string } | null;
  metrics: {
    schemaMatch?: { precision?: number; recall?: number; f1?: number };
    validRows?: number;
    totalRows?: number;
  } | null;
};

export function ValidationTable({ items }: { items: Item[] }) {
  const [isPending, start] = useTransition();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Spec</TableHead>
          <TableHead className="w-28">Result</TableHead>
          <TableHead className="w-28">F1</TableHead>
          <TableHead className="w-32">Rows</TableHead>
          <TableHead className="w-24">Unit tool</TableHead>
          <TableHead className="w-20 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r) => {
          const f1 = r.metrics?.schemaMatch?.f1;
          const rows =
            r.metrics?.validRows != null && r.metrics?.totalRows != null
              ? `${r.metrics.validRows}/${r.metrics.totalRows}`
              : "—";
          return (
            <TableRow key={r.id} className="align-top">
              <TableCell title={new Date(r.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(r.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>{r.datasetFile?.filename ?? "—"}</TableCell>
              <TableCell>
                {r.spec ? (
                  <Link
                    href={`/specs/${r.spec.id}`}
                    className="underline underline-offset-2"
                  >
                    {r.spec.name} · {r.spec.version}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell
                className={r.passed ? "text-green-600" : "text-red-600"}
              >
                {r.passed ? "PASS" : "FAIL"}
              </TableCell>
              <TableCell className="tabular-nums">
                {f1 != null ? f1.toFixed(3) : "—"}
              </TableCell>
              <TableCell className="tabular-nums">{rows}</TableCell>
              <TableCell>{r.unitTool ? "on" : "off"}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem asChild>
                      <Link href={`/validation/${r.id}`}>Open</Link>
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
                            Delete validation run?
                          </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() =>
                              start(async () => {
                                await deleteValidationRun(r.id);
                              })
                            }
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
          );
        })}
        {items.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={8}
              className="text-center text-muted-foreground"
            >
              No validation runs yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
