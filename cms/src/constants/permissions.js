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

  EXPENSE_CREATE: "expense:create",
  EXPENSE_UPDATE: "expense:update",
  EXPENSE_DELETE: "expense:delete",
  EXPENSE_VIEW_ALL: "expense:viewAll",

  // Unified category admin (income / expense / other-income).
  CATEGORY_MANAGE: "category:manage",

  // In-kind / non-cash receipts.
  OTHER_INCOME_CREATE: "otherIncome:create",
  OTHER_INCOME_UPDATE: "otherIncome:update",
  OTHER_INCOME_DELETE: "otherIncome:delete",
  OTHER_INCOME_VIEW_ALL: "otherIncome:viewAll",

  FINANCIAL_YEAR_MANAGE: "financialYear:manage",
  BANK_ACCOUNT_MANAGE: "bankAccount:manage",
  BANK_ACCOUNT_VIEW: "bankAccount:view",
  TRANSFER_MANAGE: "transfer:manage",

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
    label: "Expenses",
    items: [
      { key: PERMISSIONS.EXPENSE_CREATE, label: "Add expenses" },
      { key: PERMISSIONS.EXPENSE_UPDATE, label: "Edit expenses" },
      { key: PERMISSIONS.EXPENSE_DELETE, label: "Delete expenses" },
      {
        key: PERMISSIONS.EXPENSE_VIEW_ALL,
        label: "View all expenses (not just own)",
      },
    ],
  },
  {
    label: "Other Income (in-kind)",
    items: [
      { key: PERMISSIONS.OTHER_INCOME_CREATE, label: "Add in-kind receipts" },
      { key: PERMISSIONS.OTHER_INCOME_UPDATE, label: "Edit in-kind receipts" },
      { key: PERMISSIONS.OTHER_INCOME_DELETE, label: "Delete in-kind receipts" },
      {
        key: PERMISSIONS.OTHER_INCOME_VIEW_ALL,
        label: "View all in-kind receipts (not just own)",
      },
    ],
  },
  {
    label: "Categories & Financials",
    items: [
      { key: PERMISSIONS.CATEGORY_MANAGE, label: "Manage categories (income / expense / other)" },
      {
        key: PERMISSIONS.FINANCIAL_YEAR_MANAGE,
        label: "Manage financial years (create, close, reopen)",
      },
      {
        key: PERMISSIONS.BANK_ACCOUNT_MANAGE,
        label: "Manage bank accounts",
      },
      {
        key: PERMISSIONS.BANK_ACCOUNT_VIEW,
        label: "View bank accounts (balances & ledger)",
      },
      {
        key: PERMISSIONS.TRANSFER_MANAGE,
        label: "Manage transfers (cash / bank / fixed deposits)",
      },
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
