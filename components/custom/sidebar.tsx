"use client";
import { useScrollRef } from "@/lib/hooks/useScrollRef";
import { chatsMock } from "@/lib/mock";
import { Book, PanelLeftClose, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "../ui/button";
import SidebarButton from "./sidebar-button";
import TooltipWrapper from "./tooltip-wrapper";

export default function Sidebar() {
  const { ref: sectionRef, scrollToTop } = useScrollRef<HTMLDivElement>();

  useEffect(() => {
    scrollToTop();
  }, []);

  return (
    <nav className="flex flex-col max-w-[200px] h-full w-full border-r bg-background flex-grow-0 flex-shrink-0 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col sticky top-0 bg-background">
        <div className="flex justify-between p-2 z-[1]">
          <TooltipWrapper content="Close sidebar">
            <Button size={"icon"} variant={"ghost"}>
              <PanelLeftClose />
            </Button>
          </TooltipWrapper>
          <TooltipWrapper content="New chat">
            <Link href={"/"}>
              <Button size={"icon"} variant={"ghost"}>
                <SquarePen />
              </Button>
            </Link>
          </TooltipWrapper>
        </div>
        <div className="flex flex-col px-2">
          <SidebarButton id="/guide">
            <Book /> Guide
          </SidebarButton>
        </div>
      </div>
      <div ref={sectionRef} className="flex flex-col gap-2 mt-2">
        <span className="px-4 text-foreground/60 text-sm">Chats</span>
        <div className="flex flex-col gap-1 px-2 overflow-visible">
          {chatsMock.map((chat, idx) => (
            <SidebarButton key={idx} id={`/chat/${chat.id}`} name={chat.name} />
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 min-h-[40px] w-full bg-background" />
    </nav>
  );
}
