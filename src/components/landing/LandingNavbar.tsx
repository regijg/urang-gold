"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#features", label: "Fitur" },
  { href: "#screenshots", label: "Tampilan" },
  { href: "#pricing", label: "Harga" },
  { href: "#testimonials", label: "Testimoni" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/landing" className="flex items-center gap-2.5">
          <Image
            src="/images/logo/umroh-logo.png"
            alt="UrangApart"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="text-xl font-bold tracking-tight text-white">
            UrangApart
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-gray-400 transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/signin"
            className="hidden text-sm font-medium text-gray-300 transition hover:text-white sm:block"
          >
            Masuk
          </Link>
          <Link
            href="/signin"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Daftar Gratis
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="ml-1 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Toggle menu"
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
            <div className="mt-3 border-t border-white/10 pt-3">
              <Link
                href="/signin"
                className="block rounded-lg px-3 py-2.5 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                Masuk
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
