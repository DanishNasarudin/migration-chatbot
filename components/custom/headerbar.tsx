"use client";
import { ChatNameDTO } from "@/app/(chat)/api/chats/[chatId]/name/route";
import { cn, fetcher } from "@/lib/utils";
import { deleteChatById } from "@/services/chat";
import { Ellipsis, PanelLeftOpen, SquarePen, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage } from "usehooks-ts";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ModelSelector } from "./model-selector";
import TooltipWrapper from "./tooltip-wrapper";

export default function Headerbar({
  selectedChatModel,
}: {
  selectedChatModel: string;
}) {
  const [open, setOpen] = useLocalStorage<boolean>("ui.sidebarOpen", false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { chatId } = useParams();
  const { data, error, isLoading } = useSWR<ChatNameDTO>(
    chatId ? `/api/chats/${chatId}/name` : null,
    fetcher
  );

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      if (!data?.id) return;
      toast.promise(deleteChatById({ id: data?.id }), {
        loading: "Deleting chat...",
        success: () => {
          router.push("/chat");
          return "Chat deleted!";
        },
        error: "Failed deleting chat.",
      });
    });
  }, [data?.id, router]);

  return (
    <div className="flex justify-between p-2 h-topbar items-center border-b border-border">
      <div className={cn("flex items-center", !open && "gap-1")}>
        <AnimatePresence initial={false}>
          <motion.div
            animate={String(open)}
            variants={{
              true: { opacity: 0, position: "absolute", display: "none" },
              false: { opacity: 1, position: "static", display: "flex" },
            }}
            exit={{ opacity: 0 }}
            initial={String(open)}
            key="header-actions"
            className="flex justify-between z-[1] gap-2"
          >
            <TooltipWrapper content="Open sidebar">
              <Button
                size={"icon"}
                variant={"ghost"}
                onClick={() => setOpen(true)}
              >
                <PanelLeftOpen />
              </Button>
            </TooltipWrapper>
            <TooltipWrapper content="New chat">
              <Link href={"/"}>
                <Button size={"icon"} variant={"ghost"}>
                  <SquarePen />
                </Button>
              </Link>
            </TooltipWrapper>
            <div className="min-h-full w-[1px] bg-border"></div>
          </motion.div>
        </AnimatePresence>
        <ModelSelector
          selectedModelId={selectedChatModel}
          className={cn(!open && "ml-2")}
        />
        {chatId ? (
          isLoading ? (
            <Ellipsis className="animate-pulse stroke-foreground/60" />
          ) : error ? (
            "Chat"
          ) : (
            <p className="text-sm p-2 leading-none select-none pointer-events-none">
              {data?.name ?? "Untitled Chat"}
            </p>
          )
        ) : (
          <></>
        )}
      </div>
      {chatId && (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size={"icon"} variant={"ghost"}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="text-destructive!"
                  onClick={() => handleDelete()}
                  disabled={isPending}
                >
                  <Trash2 className="stroke-destructive" /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
