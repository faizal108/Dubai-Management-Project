// Granular permission keys — must stay in sync with server/src/lib/permissions.js.
export const PERMISSIONS = {
  DONOR_CREATE: "donor:create",
  DONOR_UPDATE: "donor:update",
  DONOR_DELETE: "donor:delete",

  DONATION_CREATE: "donation:create",
  DONATION_UPDATE: "donation:update",
  DONATION_DELETE: "donation:delete",
  DONATION_VIEW_ALL: "donation:viewAll",
  DONATION_MARK_RECEIVED: "donation:markReceived",
  DONATION_MARK_PRINTED: "donation:markPrinted",

  ACTIVITY_CREATE: "activity:create",
  ACTIVITY_UPDATE: "activity:update",
  ACTIVITY_DELETE: "activity:delete",

  REPORT_VIEW: "report:view",
  DASHBOARD_VIEW: "dashboard:view",
};

// Grouped definitions used by the Manage Employees form to render checkbox
// sections with friendly labels.
export const PERMISSION_GROUPS = [
  {
    label: "Donors",
    items: [
      { key: PERMISSIONS.DONOR_CREATE, label: "Add donors" },
      { key: PERMISSIONS.DONOR_UPDATE, label: "Edit donors" },
      { key: PERMISSIONS.DONOR_DELETE, label: "Delete donors" },
    ],
  },
  {
    label: "Donations",
    items: [
      { key: PERMISSIONS.DONATION_CREATE, label: "Add donations" },
      { key: PERMISSIONS.DONATION_UPDATE, label: "Edit donations" },
      { key: PERMISSIONS.DONATION_DELETE, label: "Delete donations" },
      {
        key: PERMISSIONS.DONATION_VIEW_ALL,
        label: "View all donations (not just own)",
      },
      {
        key: PERMISSIONS.DONATION_MARK_RECEIVED,
        label: "Mark donations received",
      },
      {
        key: PERMISSIONS.DONATION_MARK_PRINTED,
        label: "Mark donations printed",
      },
    ],
  },
  {
    label: "Activities",
    items: [
      { key: PERMISSIONS.ACTIVITY_CREATE, label: "Add activities" },
      { key: PERMISSIONS.ACTIVITY_UPDATE, label: "Edit activities" },
      { key: PERMISSIONS.ACTIVITY_DELETE, label: "Delete activities" },
    ],
  },
  {
    label: "Reports & Dashboard",
    items: [
      { key: PERMISSIONS.REPORT_VIEW, label: "View reports" },
      { key: PERMISSIONS.DASHBOARD_VIEW, label: "View dashboard" },
    ],
  },
];

// Flat list of every permission key (used for form defaults / validation).
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key)
);
