export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-[26rem]">{children}</div>
    </div>
  );
}
