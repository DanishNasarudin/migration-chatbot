import SidebarButton from "@/components/custom/sidebar-button";
import React from "react";

const links = [
  {
    href: "/dashboard",
    title: "Dashboard",
  },
  {
    href: "/datasets",
    title: "Datasets",
  },
  {
    href: "/validation",
    title: "Validations",
  },
  {
    href: "/specs",
    title: "Specs",
  },
  {
    href: "/experiments",
    title: "Experiments",
  },
  {
    href: "/chat",
    title: "Chat",
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="px-6 py-4 flex gap-2 border-b border-border">
        {links.map((l, idx) => (
          <SidebarButton key={idx} id={l.href} name={l.title} />
        ))}
      </nav>
      {children}
    </div>
  );
}
