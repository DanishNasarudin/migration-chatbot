"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as React from "react";

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: any };

export interface DownloadMetricsButtonProps {
  filename: string; // e.g. "experiment-123-metrics.json"
  payload: JSONValue; // any JSON-serializable object
  className?: string;
}

export default function DownloadMetricsButton({
  filename,
  payload,
  className,
}: DownloadMetricsButtonProps) {
  const handleDownload = React.useCallback(() => {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // release the object URL once the click has been triggered
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [filename, payload]);

  return (
    <Button type="button" onClick={handleDownload} className={className}>
      <Download className="mr-2 h-4 w-4" />
      Download metrics
    </Button>
  );
}
