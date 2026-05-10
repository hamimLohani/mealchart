"use client";

import Link from "next/link";
import { useT } from "@/i18n/use-t";

const stepKeys = [
  { title: "about.step1Title", body: "about.step1Body", icon: "📋" },
  { title: "about.step2Title", body: "about.step2Body", icon: "👥" },
  { title: "about.step3Title", body: "about.step3Body", icon: "📅" },
  { title: "about.step4Title", body: "about.step4Body", icon: "🍽️" },
  { title: "about.step5Title", body: "about.step5Body", icon: "💰" },
  { title: "about.step6Title", body: "about.step6Body", icon: "📊" },
  { title: "about.step7Title", body: "about.step7Body", icon: "🔒" },
  { title: "about.step8Title", body: "about.step8Body", icon: "📢" },
] as const;

export default function Home() {
  const { t } = useT();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-white/10 bg-[linear-gradient(135deg,_rgba(8,80,62,0.97),_rgba(6,22,44,0.99))] p-6 text-white shadow-[0_28px_80px_rgba(6,22,44,0.45)] sm:p-10 lg:grid lg:grid-cols-[1fr_auto] lg:gap-12 lg:p-14">
        <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[rgba(44,179,145,0.15)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-60 w-60 rounded-full bg-[rgba(10,122,99,0.12)] blur-3xl" />

        <div className="relative flex flex-col gap-7 sm:gap-9">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/18 bg-white/8 px-3.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2cb391]" />
            {t("home.badge")}
          </span>

          <div className="flex flex-col gap-3">
            <h1 className="max-w-2xl text-3xl font-semibold leading-[1.2] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              {t("home.title")}
            </h1>
            <p className="max-w-xl text-sm leading-7 text-white/65 sm:text-base sm:leading-8">
              {t("home.description")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              className="button-primary"
              href="/register"
              style={{ background: "white", color: "#0a1410" }}
            >
              {t("home.ctaRegister")}
            </Link>
            <Link className="button-ghost" href="/enter-group">
              {t("home.ctaEnter")}
            </Link>
            <a
              className="button-ghost"
              href="#about"
              style={{ borderColor: "rgba(44,179,145,0.4)", color: "rgba(44,179,145,0.9)" }}
            >
              {t("home.ctaAbout")}
            </a>
          </div>
        </div>

        <div className="relative mt-8 flex flex-row gap-3 lg:mt-0 lg:flex-col lg:justify-center">
          {[
            { label: t("home.statBackend"), value: t("home.statFirebase") },
            { label: t("home.statMode"), value: t("home.statMultiGroup") },
            { label: t("home.statTarget"), value: t("home.statHostelMess") },
          ].map((stat) => (
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

      {/* ── About / How It Works ──────────────────────────────── */}
      <section id="about" className="mt-16 scroll-mt-8 sm:mt-20">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("about.sectionTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--soft-foreground)] sm:text-base sm:leading-8">
            {t("about.sectionSubtitle")}
          </p>
        </div>

        {/* Steps grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stepKeys.map((step) => (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:border-[color:var(--accent)] hover:shadow-[0_8px_30px_rgba(44,179,145,0.1)]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--accent-dim)] text-lg transition-transform duration-300 group-hover:scale-110">
                {step.icon}
              </div>
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                {t(step.title)}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[color:var(--soft-foreground)]">
                {t(step.body)}
              </p>
            </div>
          ))}
        </div>

        {/* Quick summary cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[color:var(--accent)]/30 bg-[linear-gradient(135deg,_rgba(44,179,145,0.06),_rgba(44,179,145,0.02))] p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-dim)] text-sm">🛡️</span>
              <h3 className="font-semibold text-[color:var(--foreground)]">{t("about.adminTitle")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--soft-foreground)]">
              {t("about.adminBody")}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-[color:var(--accent)]/30 bg-[linear-gradient(135deg,_rgba(44,179,145,0.06),_rgba(44,179,145,0.02))] p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-dim)] text-sm">👤</span>
              <h3 className="font-semibold text-[color:var(--foreground)]">{t("about.memberTitle")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--soft-foreground)]">
              {t("about.memberBody")}
            </p>
          </div>
        </div>

        {/* CTA after about */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link className="button-primary" href="/register">
            {t("home.ctaRegister")}
          </Link>
          <Link className="button-secondary" href="/enter-group">
            {t("home.ctaEnter")}
          </Link>
        </div>
      </section>
    </main>
  );
}
