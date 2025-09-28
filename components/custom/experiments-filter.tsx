"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Props = {
  modelOptions: string[];
  promptOptions: (string | null)[];
  driftOptions: string[]; // include "none" (map nulls to "none" on server)
  unitOptions: string[];
};

function useUrlUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>, replace?: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const url = `${pathname}?${params.toString()}`;
      replace ? router.replace(url) : router.push(url);
    },
    [router, pathname, searchParams]
  );

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams]
  );

  return { setParams, get };
}

export function ExperimentFilters({
  modelOptions,
  promptOptions,
  driftOptions,
  unitOptions,
}: Props) {
  const { setParams, get } = useUrlUpdate();

  // read current values from URL (so SSR page can read them too)
  const model = get("model") ?? "";
  const prompt = get("prompt") ?? "";
  const drift = get("drift") ?? "";
  const unit = get("unit") ?? "";
  const daysInitial = (() => {
    const v = Number(get("days"));
    return Number.isFinite(v) ? Math.max(1, Math.min(180, v)) : 90;
  })();
  const [days, setDays] = useState<number>(daysInitial);

  const commitDays = useCallback(() => {
    const clamped = Math.max(1, Math.min(180, days || 90));
    setDays(clamped);
    setParams({ days: String(clamped) }, true);
  }, [days, setParams]);

  const sortedModels = useMemo(
    () => [...new Set(modelOptions)].sort(),
    [modelOptions]
  );
  const sortedPrompts = useMemo(
    () => [...new Set(promptOptions)].sort(),
    [promptOptions]
  );
  const sortedDrifts = useMemo(
    () => [...new Set(driftOptions)].sort(),
    [driftOptions]
  );
  const sortedUnits = useMemo(
    () => [...new Set(unitOptions)].sort(),
    [unitOptions]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      {/* Model */}
      <div className="md:col-span-4">
        <Label className="mb-1 block">Model</Label>
        <Select
          defaultValue={model}
          onValueChange={(v) =>
            setParams({ model: v === "all" ? null : v || null }, true)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {sortedModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompt */}
      <div className="md:col-span-4">
        <Label className="mb-1 block">Prompt</Label>
        <Select
          defaultValue={prompt}
          onValueChange={(v) =>
            setParams({ prompt: v === "all" ? null : v || null }, true)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All prompts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All prompts</SelectItem>
            {sortedPrompts.map((p) => (
              <SelectItem key={p} value={p === null ? "null" : p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drift */}
      <div className="md:col-span-4">
        <Label className="mb-1 block">Drift</Label>
        <Select
          defaultValue={drift}
          onValueChange={(v) =>
            setParams({ drift: v === "all" ? null : v || null }, true)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All drift cases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drift cases</SelectItem>
            {sortedDrifts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unit */}
      <div className="md:col-span-4">
        <Label className="mb-1 block">Unit</Label>
        <Select
          defaultValue={unit}
          onValueChange={(v) =>
            setParams({ unit: v === "all" ? null : v || null }, true)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All drift cases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All unit cases</SelectItem>
            {sortedUnits.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Days window */}
      <div className="md:col-span-2">
        <Label className="mb-1 block">Window (days)</Label>
        <Input
          type="number"
          min={1}
          max={180}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          onBlur={commitDays}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDays();
          }}
        />
      </div>

      {/* Reset */}
      <div className="md:col-span-2 flex items-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setParams(
              {
                model: null,
                prompt: null,
                drift: null,
                days: String(daysInitial),
              },
              true
            )
          }
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
