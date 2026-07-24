import React from "react";
import { PageHeader, Tabs } from "../../../components/ui";
import { ROLES } from "../../../constants/roles";
import { useAuth } from "../../../context/AuthContext";
import AppearanceSettings from "../components/AppearanceSettings";
import OrganizationSettings from "../components/OrganizationSettings";
import ReceiptBuilder from "../components/ReceiptBuilder";

// SettingsPage is the home for everything that isn't a per-resource form.
// Tabs keep adding new sections (Notifications, Integrations, …) cheap.
export default function SettingsPage() {
  const { user } = useAuth();
  const canManageOrg =
    user?.role === ROLES.ADMIN || user?.role === ROLES.SUPERADMIN;

  const tabs = [
    {
      key: "appearance",
      label: "Appearance",
      content: <AppearanceSettings />,
    },
  ];

  if (canManageOrg) {
    tabs.push({
      key: "organization",
      label: "Organization",
      content: <OrganizationSettings />,
    });
    tabs.push({
      key: "receipt",
      label: "Receipt",
      content: <ReceiptBuilder />,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Settings"
        subtitle="Personalize how the application looks and configure your organization."
      />
      <Tabs tabs={tabs} />
    </div>
  );
}
