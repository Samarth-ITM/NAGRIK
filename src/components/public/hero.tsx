import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, HandCoins, Map, MapPin, Send } from "lucide-react";
import { PUBLIC_BOT_URL } from "@/lib/telegram/public";

const destinations = [
  { href: "/#issues", label: "Explore the issue map", detail: "See what’s happening nearby", Icon: Map },
  { href: "/fund", label: "Fund local repairs", detail: "Support work in your neighbourhood", Icon: HandCoins },
  { href: "/login?role=ngo", label: "NGO field desk", detail: "Manage assigned issues", Icon: Building2 },
];

export function Hero() {
  return (
    <>
      <section className="street-cover" aria-labelledby="street-title">
        <Image src="/art/kharghar-evening.webp" alt="" fill priority sizes="(max-width: 740px) 900px, 100vw" className="street-cover__art" />
        <div className="street-cover__inner">
          <p className="street-location"><MapPin size={15} aria-hidden /> Kharghar, Navi Mumbai</p>
          <h1 id="street-title">Your street.<br /><em>Your say.</em></h1>
          <p className="street-intro">A broken streetlight? A drain that overflows? Report it on Telegram and follow the repair, right down to the photo.</p>
          <div className="street-actions">
            <a className="street-primary" href={PUBLIC_BOT_URL} target="_blank" rel="noopener noreferrer"><Send size={17} aria-hidden />Report on Telegram</a>
            <Link href="/login?role=citizen">Track my tickets <ArrowRight size={16} aria-hidden /></Link>
          </div>
          <p className="street-languages">English <span>·</span> हिन्दी <span>·</span> मराठी</p>
        </div>
      </section>

      <nav className="street-directory" aria-label="Neighbourhood services">
        {destinations.map(({ href, label, detail, Icon }) => (
          <Link key={href} href={href}><Icon size={24} strokeWidth={1.5} aria-hidden /><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight size={16} aria-hidden /></Link>
        ))}
      </nav>
    </>
  );
}
