"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui-store";

const copy = {
  en: {
    badge: "Realtime hostel and mess meal management",
    title: "One shared app for every group, with clean monthly accounting.",
    description:
      "Admins register their group, get a token instantly, and manage members, meals, costs, deposits, notices, and monthly charts from one place.",
    primary: "Register Group",
    secondary: "Enter With Token",
    admin: "Admin Login",
    sectionsTitle: "Planned MVP",
    sections: [
      "Admin self-registration with auto-generated group token",
      "Member entry by group token only",
      "Realtime meals, costs, deposits, and notices",
      "Monthly chart view and money management summary",
    ],
    stats: [
      { label: "Backend", value: "Firebase Only" },
      { label: "Mode", value: "Multi Group" },
      { label: "Target", value: "Hostel + Mess" },
    ],
  },
  bn: {
    badge: "হোস্টেল এবং মেসের জন্য রিয়েলটাইম মিল ম্যানেজমেন্ট",
    title: "একটি অ্যাপেই একাধিক গ্রুপ, পরিষ্কার মাসিক হিসাবসহ।",
    description:
      "অ্যাডমিন গ্রুপ রেজিস্টার করবে, সাথে সাথে টোকেন পাবে, তারপর সদস্য, মিল, খরচ, জমা টাকা, নোটিশ এবং মাসিক চার্ট এক জায়গা থেকে পরিচালনা করবে।",
    primary: "গ্রুপ রেজিস্টার",
    secondary: "টোকেন দিয়ে প্রবেশ",
    admin: "অ্যাডমিন লগইন",
    sectionsTitle: "প্রথম সংস্করণের পরিকল্পনা",
    sections: [
      "অ্যাডমিন রেজিস্ট্রেশনের পর অটো গ্রুপ টোকেন",
      "শুধু গ্রুপ টোকেন দিয়ে সদস্য প্রবেশ",
      "রিয়েলটাইম মিল, খরচ, জমা টাকা এবং নোটিশ",
      "মাসভিত্তিক চার্ট ও টাকা ব্যবস্থাপনা",
    ],
    stats: [
      { label: "ব্যাকএন্ড", value: "শুধু Firebase" },
      { label: "মোড", value: "মাল্টি গ্রুপ" },
      { label: "টার্গেট", value: "হোস্টেল + মেস" },
    ],
  },
} as const;

export default function Home() {
  const language = useUiStore((state) => state.language);
  const t = copy[language];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-16 pt-8 sm:px-8">
      <section className="grid gap-8 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_34%),linear-gradient(135deg,_rgba(11,94,77,0.96),_rgba(8,28,55,0.98))] p-8 text-white shadow-[0_30px_120px_rgba(8,28,55,0.45)] lg:grid-cols-[1.3fr_0.7fr] lg:p-12">
        <div className="space-y-8">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
            {t.badge}
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {t.description}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="button-primary" href="/register">
              {t.primary}
            </Link>
            <Link className="button-secondary" href="/enter-group">
              {t.secondary}
            </Link>
            <Link className="button-ghost" href="/admin/login">
              {t.admin}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 rounded-[1.75rem] border border-white/12 bg-black/18 p-5 backdrop-blur">
          {t.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[1.25rem] border border-white/10 bg-white/8 p-4"
            >
              <p className="text-xs uppercase tracking-[0.28em] text-white/55">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {t.sections.map((item, index) => (
          <article
            key={item}
            className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              0{index + 1}
            </p>
            <h2 className="mt-4 text-lg font-semibold text-[color:var(--foreground)]">
              {item}
            </h2>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              {t.sectionsTitle}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
              Project shell is ready for Firebase integration.
            </h2>
          </div>
          <Link className="button-primary" href="/admin">
            Open App Map
          </Link>
        </div>
      </section>
    </main>
  );
}
