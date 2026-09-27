"use client";

import React from "react";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[240px]"
    : "lg:ml-[76px]";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin} print:ml-0`}>
        <AppHeader />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-5 print:p-0">{children}</div>
      </div>
    </div>
  );
}
