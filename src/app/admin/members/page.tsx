"use client";

import { PageCard } from "@/components/layout/page-card";
import { MemberManager } from "@/components/admin/member-manager";
import { useT } from "@/i18n/use-t";

export default function MembersPage() {
  const { t } = useT();

  return (
    <PageCard
      eyebrow={t("adminMembers.eyebrow")}
      title={t("adminMembers.title")}
      description={t("adminMembers.description")}
    >
      <MemberManager />
    </PageCard>
  );
}
