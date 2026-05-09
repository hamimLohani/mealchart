import Link from "next/link";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--panel)] mt-auto relative z-10 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-6 md:flex md:items-center md:justify-between">
          <div className="flex justify-center space-x-6 md:order-2">
            <Link href="https://github.com/hamimLohani" target="_blank" rel="noopener noreferrer" className="text-[color:var(--muted)] hover:text-[color:var(--accent)] transition-colors duration-200">
              <span className="sr-only">GitHub</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
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
