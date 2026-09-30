"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import UrangGoldMark from "@/images/logo/uranggold-mark.svg";

const navLinks = [
  { href: "#fitur", label: "Fitur" },
  { href: "#alur", label: "Cara Kerja" },
  { href: "#keamanan", label: "Keamanan" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/landing" className="flex items-center gap-2.5">
          <UrangGoldMark className="h-9 w-9" />
          <span className="text-xl font-bold tracking-tight text-white">UrangGold</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-gray-400 transition hover:text-white">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">
            Masuk
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="ml-1 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Buka menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/5 bg-gray-950/95 px-4 pb-5 pt-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
