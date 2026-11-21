"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Send, Shield, X } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";

const NAV = [
  { label: "How it works", href: "/#how-it-works", section: "how-it-works" },
  { label: "What to report", href: "/#categories", section: "categories" },
  { label: "Map", href: "/#issues", section: "issues" },
  { label: "Fund", href: "/fund" },
  { label: "Privacy", href: "/privacy" },
  { label: "About", href: "/about" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [partner, setPartner] = useState<{ name: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    fetch("/api/ngo/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.success && data.profile?.name) setPartner(data.profile);
      })
      .catch(() => {});
  }, []);

  // Highlight the menu item for the section currently on screen (home page only).
  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection(null);
      return;
    }
    const ids = NAV.filter((n) => n.section).map((n) => n.section as string);
    // Sections in page order; the active one is the last whose top has passed just below the header.
    const LINE = 120;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= LINE) current = id;
      }
      // Past the last tracked section (e.g. lower sections without a menu item): clear the highlight.
      const last = ids.length ? document.getElementById(ids[ids.length - 1]) : null;
      if (current && current === ids[ids.length - 1] && last && last.getBoundingClientRect().bottom < LINE) {
        current = null;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // Close the phone menu on navigation or Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (n: (typeof NAV)[number]) =>
    n.section ? pathname === "/" && activeSection === n.section : pathname === n.href;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 rounded-lg" aria-label="Nagrik home">
          <span className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
            <Shield className="w-[18px] h-[18px]" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-[17px] font-extrabold tracking-tight text-slate-900">Nagrik</span>
            <span className="block text-xs text-slate-500">Kharghar, Navi Mumbai</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active = isActive(n);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap px-3 py-2 rounded-lg text-[15px] font-medium transition-colors ${
                  active ? "text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                }`}
              >
                {n.label}
                <span
                  aria-hidden
                  className={`absolute left-3 right-3 -bottom-[13px] h-[3px] rounded-full bg-brand-500 transition-opacity duration-300 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {partner && (
            <Link
              href="/ngo"
              title={`Repairs by ${partner.name}`}
              className="hidden xl:flex items-center gap-2 max-w-[13rem] pl-1.5 pr-3 py-1 rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:border-brand-300 transition-colors"
            >
              {partner.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={partner.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-emerald-600" aria-hidden />
              )}
              <span className="truncate">{partner.name}</span>
            </Link>
          )}
          <Link
            href="/login?role=citizen"
            className="hidden sm:inline-flex items-center h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-slate-400 transition-colors whitespace-nowrap"
          >
            My tickets
          </Link>
          <Link
            href="/ngo"
            className="hidden sm:inline-flex items-center h-10 px-4 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            NGO desk
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl text-slate-800 hover:bg-white transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-slate-200 bg-slate-50 px-4 pt-3 pb-5">
          <a
            href={PUBLIC_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-brand-500 text-slate-900 font-bold"
          >
            <Send className="w-4 h-4" aria-hidden />
            Report on Telegram
          </a>
          <nav aria-label="Main" className="mt-3 grid">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex items-center min-h-[48px] px-3 rounded-lg text-base font-medium text-slate-800 hover:bg-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
            <Link
              href="/login?role=citizen"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
            >
              My tickets
            </Link>
            <Link
              href="/ngo"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center h-11 rounded-xl bg-brand-600 text-sm font-semibold text-white"
            >
              NGO desk
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
