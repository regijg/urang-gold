"use client";

import { useEffect } from "react";

/**
 * The app runs in dark mode by default (class "dark" on <html>), which would print light grey text
 * on white paper. While the print dialog is open the class is removed, then put back.
 * Mounted once in the root layout so every printed page benefits (Ctrl+P included).
 */
export function PrintLightMode() {
  useEffect(() => {
    let wasDark = false;
    const before = () => {
      const root = document.documentElement;
      if (root.classList.contains("dark")) {
        wasDark = true;
        root.classList.remove("dark");
      }
    };
    const after = () => {
      if (wasDark) document.documentElement.classList.add("dark");
      wasDark = false;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return null;
}

/** Browsers use the page title as the default file name when saving as PDF: make it describe the report. */
export function PrintTitle({ title }: { title: string }) {
  useEffect(() => {
    let previous: string | null = null;
    const before = () => {
      // idempotent: some browsers fire beforeprint more than once
      if (previous === null) previous = document.title;
      document.title = title;
    };
    const after = () => {
      if (previous !== null) document.title = previous;
      previous = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [title]);
  return null;
}
