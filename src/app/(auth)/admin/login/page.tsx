import { AdminLoginForm } from "@/components/forms/admin-login-form";

export default function AdminLoginPage() {
  return (
    <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
        Admin Login
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in to your panel</h1>
      <p className="mt-2 text-sm text-[color:var(--soft-foreground)]">
        Enter your admin email and password to continue.
      </p>
      <AdminLoginForm />
    </div>
  );
}
