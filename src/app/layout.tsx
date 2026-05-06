import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { UiProvider } from "@/components/providers/ui-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meat Chart",
  description: "Realtime hostel and mess meal management app",
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
    >
      <body className="min-h-full">
        <UiProvider>
          <div className="min-h-full bg-[color:var(--background)]">
            <AppHeader />
            {children}
          </div>
        </UiProvider>
      </body>
    </html>
  );
}
