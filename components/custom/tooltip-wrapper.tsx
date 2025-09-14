"use client";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export default function TooltipWrapper({
  children,
  content,
  alwaysOpen = false,
  side,
}: {
  children: React.ReactNode;
  content: string;
  alwaysOpen?: boolean;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider>
      <Tooltip
        {...(alwaysOpen && { defaultOpen: true, open: true })}
        delayDuration={200}
      >
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          {...(side && { side })}
          className={cn(
            "text-secondary-foreground bg-card fill-card whitespace-break-spaces text-center"
          )}
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
