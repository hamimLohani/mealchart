import { AdminLoginForm } from "@/components/forms/admin-login-form";

export default function AdminLoginPage() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow-lg)] sm:p-8">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent)] text-sm font-bold text-white shadow-[0_4px_12px_var(--accent-glow)]">
        MC
      </div>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[color:var(--muted)]">
        Admin Login
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your panel</h1>
      <p className="mt-1.5 text-sm text-[color:var(--soft-foreground)]">
        Enter your admin email and password to continue.
      </p>
      <AdminLoginForm />
    </div>
  );
}
