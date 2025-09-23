"use client";

import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Uploaded = { url: string; name: string; contentType: string; id: string };

export function DatasetsUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [queue, setQueue] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const onPick = () => inputRef.current?.click();

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const { url, pathname, contentType, id } = await res.json();
          return { url, name: pathname, contentType, id } as Uploaded;
        } else {
          const { error } = await res
            .json()
            .catch(() => ({ error: "Upload failed" }));
          toast.error(`${error ?? "Upload failed"}`);
        }
      } catch (err: any) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    [toast]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setQueue(files.map((f) => f.name));
      setBusy(true);
      try {
        const uploaded = (await Promise.all(files.map(uploadFile))).filter(
          Boolean
        ) as Uploaded[];
        if (uploaded.length) {
          toast.success(`Uploaded ${uploaded.length} file(s).`);
          // Refresh the /datasets page to show the new files
          router.refresh();
        }
      } finally {
        setQueue([]);
        setBusy(false);
      }
    },
    [router, toast, uploadFile]
  );

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      await handleFiles(files);
      // reset input so selecting the same file again re-triggers change
      e.currentTarget.value = "";
    },
    [handleFiles]
  );

  // Drag & drop
  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files ?? []);
      await handleFiles(files);
    },
    [handleFiles]
  );
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const hint = useMemo(() => {
    if (!queue.length) return null;
    return `Uploading: ${queue.slice(0, 2).join(", ")}${
      queue.length > 2 ? ` +${queue.length - 2} more` : ""
    }`;
  }, [queue]);

  return (
    <div className="rounded-lg border p-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center"
      >
        <UploadCloud className="h-6 w-6 opacity-70" />
        <div className="text-sm">Drag & drop files here, or</div>
        <div className="flex items-center gap-2">
          <Button onClick={onPick} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Choose files"
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onInputChange}
            // Accept anything; narrow if you want: accept=".csv,.xlsx,.xls,.json"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {hint ?? "Supports multiple files. Large files may take a moment."}
        </div>
      </div>
    </div>
  );
}
