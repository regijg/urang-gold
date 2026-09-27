"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MAX_WAIT_MS = 45000;

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathname = useRef(pathname);

  const clearTimers = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    tickRef.current = null;
    hideRef.current = null;
    maxWaitRef.current = null;
  };

  const finish = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    maxWaitRef.current = null;
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  };

  const start = () => {
    if (tickRef.current) return;
    if (hideRef.current) clearTimeout(hideRef.current);
    setVisible(true);
    setProgress(10);
    tickRef.current = setInterval(() => {
      setProgress((p) => (p < 85 ? p + (85 - p) * 0.1 : p));
    }, 200);
    maxWaitRef.current = setTimeout(finish, MAX_WAIT_MS);
  };

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      finish();
    }
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname) return;

      start();
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-brand-500 shadow-[0_0_8px_rgba(0,0,0,0.3)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
