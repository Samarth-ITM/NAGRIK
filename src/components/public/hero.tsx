"use client";

import Link from "next/link";
import { Building2, HandCoins, Send, Ticket } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";
import { NgoFixStack, type NgoFixStackInitial } from "@/components/public/ngo-fix-stack";
import { IssueStrip } from "@/components/public/issue-icons";

export function Hero({ initialFixes }: { initialFixes?: NgoFixStackInitial | null } = {}) {
  return (
    <section className="nk-hero">
      <div aria-hidden className="nk-hero__grid-texture" />
      <div aria-hidden className="nk-hero__sun" />

      <div className="nk-hero__inner">
        <div>
          <h1 className="nk-hero__title">Report any civic problem. See who fixed it.</h1>

          <IssueStrip kinds={["garbage", "pothole", "drain", "leak", "light", "tree"]} />

          <div className="nk-hero__actions">
            <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-btn nk-btn--kerb">
              <Send size={18} aria-hidden />
              Report on Telegram
            </a>
            <Link href="/login?role=citizen" className="nk-btn nk-btn--ghost-dark">
              <Ticket size={18} aria-hidden />
              Track my tickets
            </Link>
            <Link href="/fund" className="nk-btn nk-btn--ghost-dark">
              <HandCoins size={18} aria-hidden />
              Give funding
            </Link>
          </div>

          <div className="nk-hero__meta">
            <span>English · हिन्दी · मराठी</span>
            <Link href="/login?role=ngo">
              <Building2 size={16} aria-hidden />
              NGO desk
            </Link>
          </div>
        </div>

        <div>
          <div className="nk-hero__panel-head">
            <h2>Recently fixed</h2>
            <Link href="/#issues">See the map</Link>
          </div>
          <NgoFixStack initial={initialFixes} />
        </div>
      </div>

      <div aria-hidden className="nk-kerb-stripe" />
    </section>
  );
}
