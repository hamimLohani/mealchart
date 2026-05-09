"use client";

import Link from "next/link";
import { useT } from "@/i18n/use-t";

export default function Home() {
  const { t } = useT();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
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
            <Link
              className="button-ghost"
              href="/admin/login"
              style={{ borderStyle: "dashed" }}
            >
              {t("home.ctaAdmin")}
            </Link>
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
    </main>
  );
}
