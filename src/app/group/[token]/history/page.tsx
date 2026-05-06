import { PageCard } from "@/components/layout/page-card";

export default async function GroupHistoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PageCard
      eyebrow={`History ${token}`}
      title="Monthly history archive"
      description="This route will list previous months and link each month to its historical chart view."
    />
  );
}
