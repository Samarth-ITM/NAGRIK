"use client";

import Link from "next/link";
import { Building2, MapPin, Send, Ticket } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";
import { NgoFixStack } from "@/components/public/ngo-fix-stack";

export function Hero() {
  return (
    <section className="nk-hero">
      <div aria-hidden className="nk-hero__grid-texture" />
      <div aria-hidden className="nk-hero__sun" />

      <div className="nk-hero__inner">
        <div>
          <p className="nk-hero__where">
            <MapPin size={16} aria-hidden />
            Live pilot in Sector 4, Kharghar
          </p>

          <h1 className="nk-hero__title">Report any civic problem. See who fixed it.</h1>

          <p className="nk-hero__lede">
            Garbage piling up, a blocked drain, a water leak, a dark streetlight, a pothole, a damaged park. Send a
            photo, a voice note and the location to our Telegram bot. A partner NGO takes it up, fixes it, and posts
            an after-photo as proof.
          </p>

          <div className="nk-hero__actions">
            <a href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer" className="nk-btn nk-btn--kerb">
              <Send size={18} aria-hidden />
              Report on Telegram
            </a>
            <Link href="/login?role=citizen" className="nk-btn nk-btn--ghost-dark">
              <Ticket size={18} aria-hidden />
              Track my tickets
            </Link>
          </div>

          <div className="nk-hero__meta">
            <span>Works in English, हिन्दी and मराठी</span>
            <Link href="/login?role=ngo">
              <Building2 size={16} aria-hidden />
              NGO? Open the field desk
            </Link>
          </div>
        </div>

        <div>
          <div className="nk-hero__panel-head">
            <h2>Recently fixed</h2>
            <Link href="/#issues">See the map</Link>
          </div>
          <NgoFixStack />
        </div>
      </div>

      <div aria-hidden className="nk-kerb-stripe" />
    </section>
  );
}
