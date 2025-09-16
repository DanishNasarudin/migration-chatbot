"use client";
import { Chat } from "@/lib/generated/prisma";
import { useScrollRef } from "@/lib/hooks/use-scroll-ref";
import { fetcher } from "@/lib/utils";
import { Book, Loader2, PanelLeftClose, SquarePen } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { useLocalStorage } from "usehooks-ts";
import { Button } from "../ui/button";
import SidebarButton from "./sidebar-button";
import { ModeToggle } from "./theme-toggle";
import TooltipWrapper from "./tooltip-wrapper";

export default function Sidebar({ userId }: { userId?: string }) {
  const pathname = usePathname();
  const {
    data: history,
    isLoading,
    mutate,
  } = useSWR<Array<Chat>>(userId ? "/api/history" : null, fetcher, {
    fallbackData: [],
  });

  useEffect(() => {
    mutate();
  }, [pathname, mutate]);

  const { ref: sectionRef, scrollToTop } = useScrollRef<HTMLDivElement>();

  const [open, setOpen] = useLocalStorage<boolean>("ui.sidebarOpen", false);

  useEffect(() => {
    scrollToTop();
  }, []);

  return (
    <motion.nav
      animate={String(open)}
      variants={{
        true: { width: 200, borderRightWidth: "1px" },
        false: { width: 0, borderRightWidth: 0 },
      }}
      initial={String(open)}
      className="flex flex-col max-w-[200px] h-full w-full border-r bg-background flex-grow-0 flex-shrink-0 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex flex-col sticky top-0 bg-background">
        <div className="flex justify-between p-2 z-[1]">
          <TooltipWrapper content="Close sidebar">
            <Button
              size={"icon"}
              variant={"ghost"}
              onClick={() => setOpen(false)}
            >
              <PanelLeftClose />
            </Button>
          </TooltipWrapper>
          <TooltipWrapper content="New chat">
            <Link href={"/chat"}>
              <Button size={"icon"} variant={"ghost"}>
                <SquarePen />
              </Button>
            </Link>
          </TooltipWrapper>
        </div>
        <div className="flex flex-col px-2 pb-2">
          <SidebarButton id="/guide">
            <Book /> Guide
          </SidebarButton>
        </div>
      </div>
      {!isLoading ? (
        history && history.length > 0 ? (
          <div ref={sectionRef} className="flex flex-col gap-2 pt-2">
            <span className="px-4 text-foreground/60 text-sm select-none">
              Chats
            </span>
            <div className="flex flex-col gap-1 px-2 overflow-visible">
              {history.map((chat, idx) => (
                <SidebarButton
                  key={idx}
                  id={`/chat/${chat.id}`}
                  name={chat.title}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <span className="px-4 text-foreground/60 text-sm select-none">
              Your conversation will appear once you start chatting!
            </span>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2 pt-2 px-4 justify-center items-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
      <div className="flex-1"></div>
      <div className="sticky bottom-0 p-2 w-full bg-background">
        <ModeToggle />
      </div>
    </motion.nav>
  );
}
