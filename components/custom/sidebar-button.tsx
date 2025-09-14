"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Button } from "../ui/button";

type Props = {
  name?: string;
  id?: string;
  children?: React.ReactNode;
};

export default function SidebarButton({
  name = "default",
  id = "/",
  children,
}: Props) {
  const pathname = usePathname();
  const isActive = useMemo(() => pathname === `${id}`, [pathname, id]);

  return (
    <Link href={`${id}`}>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className="w-full justify-start px-2!"
      >
        {children ? children : name}
      </Button>
    </Link>
  );
}
