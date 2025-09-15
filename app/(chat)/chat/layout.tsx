import { DataStreamProvider } from "@/lib/providers/data-stream-provider";
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DataStreamProvider>{children}</DataStreamProvider>;
}
