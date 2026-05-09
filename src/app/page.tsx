"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui-store";

const copy = {
  en: {
    badge: "Hostel & mess meal management",
    title: "One app for every group, with clean monthly accounting.",
    description:
      "Admins register their group, get a token instantly, and manage members, meals, costs, deposits, notices, and monthly charts — all from one place.",
    primary: "Register Group",
    secondary: "Enter With Token",
    admin: "Admin Login",
    stats: [
      { label: "Backend", value: "Firebase" },
      { label: "Mode", value: "Multi-Group" },
      { label: "Target", value: "Hostel & Mess" },
    ],
  },
  bn: {
    badge: "হোস্টেল ও মেসের মিল ম্যানেজমেন্ট",
    title: "একটি অ্যাপেই একাধিক গ্রুপ, পরিষ্কার মাসিক হিসাবসহ।",
    description:
      "অ্যাডমিন গ্রুপ রেজিস্টার করবে, সাথে সাথে টোকেন পাবে, তারপর সদস্য, মিল, খরচ, জমা, নোটিশ ও মাসিক চার্ট এক জায়গা থেকে পরিচালনা করবে।",
    primary: "গ্রুপ রেজিস্টার",
    secondary: "টোকেন দিয়ে প্রবেশ",
    admin: "অ্যাডমিন লগইন",
    stats: [
      { label: "ব্যাকএন্ড", value: "Firebase" },
      { label: "মোড", value: "মাল্টি-গ্রুপ" },
      { label: "টার্গেট", value: "হোস্টেল ও মেস" },
    ],
  },
} as const;

export default function Home() {
  const language = useUiStore((state) => state.language);
  const t = copy[language];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-white/10 bg-[linear-gradient(135deg,_rgba(8,80,62,0.97),_rgba(6,22,44,0.99))] p-6 text-white shadow-[0_28px_80px_rgba(6,22,44,0.45)] sm:p-10 lg:grid lg:grid-cols-[1fr_auto] lg:gap-12 lg:p-14">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[rgba(44,179,145,0.15)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-60 w-60 rounded-full bg-[rgba(10,122,99,0.12)] blur-3xl" />

        {/* Left: copy + CTA */}
        <div className="relative flex flex-col gap-7 sm:gap-9">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/18 bg-white/8 px-3.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2cb391]" />
            {t.badge}
          </span>

          <div className="flex flex-col gap-3">
            <h1 className="max-w-2xl text-3xl font-semibold leading-[1.2] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              {t.title}
            </h1>
            <p className="max-w-xl text-sm leading-7 text-white/65 sm:text-base sm:leading-8">
              {t.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              className="button-primary"
              href="/register"
              style={{ background: "white", color: "#0a1410" }}
            >
              {t.primary}
            </Link>
            <Link className="button-ghost" href="/enter-group">
              {t.secondary}
            </Link>
            <Link
              className="button-ghost"
              href="/admin/login"
              style={{ borderStyle: "dashed" }}
            >
              {t.admin}
            </Link>
          </div>
        </div>

        {/* Right: stats */}
        <div className="relative mt-8 flex flex-row gap-3 lg:mt-0 lg:flex-col lg:justify-center">
          {t.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex-1 rounded-[var(--radius)] border border-white/10 bg-white/6 p-3.5 text-center backdrop-blur-sm sm:p-4 lg:min-w-[9rem] lg:text-left"
            >
              <p className="text-[0.62rem] uppercase tracking-[0.24em] text-white/45 sm:text-xs">
                {stat.label}
              </p>
              <p className="mt-1.5 text-base font-semibold sm:text-xl">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
