import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { UiProvider } from "@/components/providers/ui-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meat Chart",
  description: "Realtime hostel and mess meal management app",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <UiProvider>
          <div className="min-h-screen flex flex-col bg-[color:var(--background)]">
            <AppHeader />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            <AppFooter />
          </div>
        </UiProvider>
      </body>
    </html>
  );
}
