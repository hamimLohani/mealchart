"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();

  // Only show footer on the root home page
  if (pathname !== "/") return null;

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--panel)] mt-auto relative z-10 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-6 md:flex md:items-center md:justify-between">
          <div className="flex justify-center space-x-6 md:order-2">
            <Link href="tel:+8801750343582" className="text-[color:var(--muted)] hover:text-[color:var(--accent)] transition-colors duration-200">
              <span className="sr-only">Phone</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </Link>
            <Link href="https://linkedin.com/in/hamimlohani" target="_blank" rel="noopener noreferrer" className="text-[color:var(--muted)] hover:text-[color:var(--accent)] transition-colors duration-200">
              <span className="sr-only">LinkedIn</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link href="mailto:hamimlohani@gmail.com" className="text-[color:var(--muted)] hover:text-[color:var(--accent)] transition-colors duration-200">
              <span className="sr-only">Contact</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </Link>
          </div>
          <div className="mt-8 md:order-1 md:mt-0 flex flex-col items-center md:items-start gap-3">
            <p className="text-center md:text-left text-xs leading-5 text-[color:var(--muted)] font-medium">
              &copy; {currentYear} Meat Chart. All rights reserved. <span className="hidden sm:inline">|</span> <span className="block sm:inline mt-1 sm:mt-0">Designed for optimal meal management.</span>
            </p>
            <div className="text-center md:text-left text-xs text-[color:var(--muted)] flex flex-col gap-1">
              <span className="font-semibold text-[color:var(--soft-foreground)]">Developed by Md Inzamamul Lohani</span>
              <span>Software Engineering, University of Dhaka</span>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-0.5">
                <a href="mailto:hamimlohani@gmail.com" className="hover:text-[color:var(--accent)] transition-colors">hamimlohani@gmail.com</a>
                <span className="text-[color:var(--border-strong)]">•</span>
                <a href="tel:01750343582" className="hover:text-[color:var(--accent)] transition-colors">01750343582</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
