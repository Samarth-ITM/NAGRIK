"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, Menu, X, ArrowUpRight } from "lucide-react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Issue Categories", href: "/#categories" },
    { label: "Public Issues", href: "/#issues" },
    { label: "Accountability", href: "/#accountability" },
    { label: "Pilot Area", href: "/#pilot-area" },
    { label: "About", href: "/#about" },
  ];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white group focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:bg-brand-700 transition">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="leading-none text-base tracking-tight font-extrabold text-slate-900 dark:text-white">
              NAGRIK
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-normal">
              Sector 4, Kharghar
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="hover:text-brand-600 dark:hover:text-brand-400 transition focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1 py-0.5"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <span>Authority Login</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center block text-xs px-3.5 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition"
            >
              Authority Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
