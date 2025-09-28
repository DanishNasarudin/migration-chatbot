"use client";

import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronsUpDown, X } from "lucide-react";

/**
 * Helpers
 */
function useUrlUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (
      patch: Record<string, string | null | undefined>,
      opts?: { replace?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const url = `${pathname}?${params.toString()}`;
      if (opts?.replace) router.replace(url);
      else router.push(url);
    },
    [router, pathname, searchParams]
  );

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams]
  );

  return { setParams, get };
}

function numberOr<T extends number>(
  val: string | undefined,
  fallback: T,
  min?: number,
  max?: number
): number {
  const n = val != null ? Number(val) : NaN;
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (min != null) out = Math.max(min, out);
  if (max != null) out = Math.min(max, out);
  return out;
}

/**
 * ScopeTabs — toggles between Chat vs Experiments by updating the `tab` URL param.
 * Purely client-side visual switch; your server page can also read `searchParams.tab` if needed.
 */
export function ScopeTabs({ className }: { className?: string }) {
  const { setParams, get } = useUrlUpdate();
  const value =
    (get("tab") as "chat" | "experiments" | undefined) ?? "experiments";
  return (
    <Tabs
      value={value}
      onValueChange={(v) => setParams({ tab: v }, { replace: true })}
      className={className}
    >
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="chat">Chat metrics</TabsTrigger>
        <TabsTrigger value="experiments">Experiment metrics</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/**
 * Combobox primitives (shadcn Command + Popover)
 */
export type Option = { value: string; label: string };

function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyText = "No items found",
  className,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate text-left">
            {current ? current.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          filter={(v, s) => (s.toLowerCase().includes(v.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    setOpen(false);
                    onChange(o.value === value ? undefined : o.value);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      o.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * ExperimentCombobox — selects a specific experiment (writes `expId` URL param)
 */
export function ExperimentCombobox({ experiments }: { experiments: Option[] }) {
  const { setParams, get } = useUrlUpdate();
  const expId = get("expId");
  return (
    <div className="grid gap-1">
      <Label>Experiment</Label>
      <div className="flex gap-2">
        <Combobox
          value={expId}
          onChange={(v) => setParams({ expId: v ?? null }, { replace: true })}
          options={[{ value: "", label: "All experiments" }, ...experiments]}
          placeholder="All experiments"
        />
        {expId ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear experiment"
            onClick={() => setParams({ expId: null }, { replace: true })}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ModelCombobox — selects a single model (writes `modelId` URL param)
 */
export function ModelCombobox({ models }: { models: Option[] }) {
  const { setParams, get } = useUrlUpdate();
  const modelId = get("modelId");
  return (
    <div className="grid gap-1">
      <Label>Model</Label>
      <div className="flex gap-2">
        <Combobox
          value={modelId}
          onChange={(v) => setParams({ modelId: v ?? null }, { replace: true })}
          options={[{ value: "", label: "All models" }, ...models]}
          placeholder="All models"
        />
        {modelId ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear model"
            onClick={() => setParams({ modelId: null }, { replace: true })}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * TagInput — free text tag filter (writes `tag` URL param). Debounced.
 */
export function TagInput() {
  const { setParams, get } = useUrlUpdate();
  const [val, setVal] = useState<string>(get("tag") ?? "");

  React.useEffect(() => {
    const t = setTimeout(
      () => setParams({ tag: val || null }, { replace: true }),
      500
    );
    return () => clearTimeout(t);
  }, [val, setParams]);

  return (
    <div className="grid gap-1">
      <Label>Tag</Label>
      <Input
        placeholder="e.g. exp/schema:fewshot"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
    </div>
  );
}

/**
 * WindowDaysInput — numeric days window (writes `days` URL param) on blur/Enter.
 */
export function WindowDaysInput({
  min = 1,
  max = 90,
}: {
  min?: number;
  max?: number;
}) {
  const { setParams, get } = useUrlUpdate();
  const [val, setVal] = useState<number>(
    numberOr(get("days") ?? undefined, 7, min, max)
  );

  const commit = useCallback(() => {
    const clamped = Math.max(min, Math.min(max, val || 7));
    setVal(clamped);
    setParams({ days: String(clamped) }, { replace: true });
  }, [val, min, max, setParams]);

  return (
    <div className="grid gap-1">
      <Label>Window (days)</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </div>
  );
}

/**
 * ResetFiltersButton — clears expId, modelId, tag; keeps days.
 */
export function ResetFiltersButton({ className }: { className?: string }) {
  const { setParams, get } = useUrlUpdate();
  const days = get("days");
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() =>
        setParams(
          { expId: null, modelId: null, tag: null, days: days ?? undefined },
          { replace: true }
        )
      }
    >
      Reset
    </Button>
  );
}

/**
 * DashboardFilters — ready-to-use filter bar that composes the bits above.
 * Pass server-fetched option lists from your page.tsx.
 */
export function DashboardFilters({
  experiments,
  models,
  className,
}: {
  experiments: Option[];
  models: Option[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-12 gap-3 items-end",
        className
      )}
    >
      <div className="md:col-span-4">
        <ExperimentCombobox experiments={experiments} />
      </div>
      <div className="md:col-span-3">
        <ModelCombobox models={models} />
      </div>
      <div className="md:col-span-3">
        <TagInput />
      </div>
      <div className="md:col-span-2">
        <WindowDaysInput />
      </div>
      <div className="md:col-span-12 flex gap-2">
        <ResetFiltersButton />
      </div>
    </div>
  );
}
