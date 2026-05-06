import { PageCard } from "@/components/layout/page-card";
import { NoticesManager } from "@/components/admin/notices-manager";

export default function AdminNoticesPage() {
  return (
    <PageCard
      eyebrow="Notices"
      title="Group notices"
      description="Add, edit, and delete manual notices. System actions create automatic notices automatically."
    >
      <NoticesManager />
    </PageCard>
  );
}
