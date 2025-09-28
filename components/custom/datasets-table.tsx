"use client";

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
import { deleteDatasetFile, getProfileAndLatestSpec } from "@/services/file";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal } from "lucide-react";
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
} from "../ui/alert-dialog";

type DatasetRow = {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string; // ISO
};

type ProfileState = null | {
  filename: string;
  latestSpecId: string | null;
  rowCount: number;
  columns: Array<{
    name: string;
    inferredType?: string;
    nullRate?: number;
    distinctCount?: number;
    unitCandidates?: string[];
  }>;
};

export function DatasetsTable({ items }: { items: DatasetRow[] }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(null);
  const [isPending, startTransition] = useTransition();

  const handleViewProfile = (id: string) => {
    startTransition(async () => {
      const res = await getProfileAndLatestSpec(id);
      setProfile({
        filename: res.filename,
        latestSpecId: res.latestSpecId,
        rowCount: res.profile.rowCount,
        columns: res.profile.columns ?? [],
      });
      setOpen(true);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteDatasetFile(id);
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead className="w-32 text-right">Size</TableHead>
            <TableHead className="w-48">Uploaded</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((f) => (
            <DatasetsRow
              key={f.id}
              item={f}
              onViewProfile={(id) => handleViewProfile(id)}
              onDelete={(id) => handleDelete(id)}
            />
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No datasets yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {profile ? `Profile: ${profile.filename}` : "Profile"}
            </DialogTitle>
          </DialogHeader>

          {isPending && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          {profile && !isPending && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  Rows: <span className="font-mono">{profile.rowCount}</span>
                </div>
                {profile.latestSpecId ? (
                  <Link
                    href={`/specs/${profile.latestSpecId}`}
                    className="text-sm underline underline-offset-2"
                  >
                    View latest spec →
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No spec yet
                  </span>
                )}
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-24">Null %</TableHead>
                      <TableHead className="w-28">Distinct</TableHead>
                      <TableHead>Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.columns.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.inferredType ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {fmtPct(c.nullRate)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {c.distinctCount ?? "—"}
                        </TableCell>
                        <TableCell>
                          {c.unitCandidates?.length
                            ? c.unitCandidates.join(", ")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatBytes(n: number) {
  if (!n) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function fmtPct(p?: number) {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function DatasetsRow({
  item: f,
  onViewProfile,
  onDelete,
}: {
  item: DatasetRow;
  onViewProfile: (id: string) => void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [isPending, start] = useTransition();

  return (
    <TableRow key={f.id} className="align-top">
      <TableCell className="font-medium">{f.filename}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatBytes(f.sizeBytes)}
      </TableCell>
      <TableCell title={new Date(f.createdAt).toLocaleString()}>
        {formatDistanceToNow(new Date(f.createdAt), {
          addSuffix: true,
        })}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => {
                onViewProfile(f.id);
              }}
            >
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => {
                setMenuOpen(false);
                setOpenDelete(true);
              }}
              disabled={isPending}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
          <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    start(async () => {
                      await onDelete(f.id);
                      setOpenDelete(false);
                    });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
