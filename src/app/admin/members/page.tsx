import { PageCard } from "@/components/layout/page-card";
import { MemberManager } from "@/components/admin/member-manager";

export default function MembersPage() {
  return (
    <PageCard
      eyebrow="Members"
      title="Member management workspace"
      description="This section will handle search, add, edit, remove, join dates, phone numbers, and auto-generated notice entries."
    >
      <MemberManager />
    </PageCard>
  );
}
