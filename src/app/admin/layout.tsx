import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMobileBar } from "@/components/admin/admin-mobile-bar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto w-full max-w-7xl px-2.5 py-4 sm:px-8 sm:py-6 md:flex md:items-start md:gap-6 md:py-8">
      {/* Sidebar — desktop only */}
      <aside className="hidden shrink-0 md:block md:w-56 lg:w-64">
        <div className="sticky top-20">
          <AdminNav />
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        {/* Mobile top bar — back + panel label */}
        <div className="mb-4 md:hidden">
          <AdminMobileBar />
        </div>
        {children}
      </main>
    </div>
  );
}
