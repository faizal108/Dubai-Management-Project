// src/App.jsx

import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { FinancialYearProvider } from "./context/FinancialYearContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import HomeRedirect from "./components/HomeRedirect";
import { ROLES } from "./constants/roles";
import { PERMISSIONS } from "./constants/permissions";
import { ErrorBoundary, Spinner } from "./components/ui";

const Dashboard = lazy(() => import("./features/dashboard/pages/Dashboard"));
const AddDonor = lazy(() => import("./features/donors/pages/AddDonor"));
const AddDonation = lazy(() => import("./features/donations/pages/AddDonation"));
const SearchDonation = lazy(() => import("./features/donations/pages/SearchDonation"));
const DonorHistory = lazy(() => import("./features/donations/pages/DonorHistory"));
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage"));
const Unauthorized = lazy(() => import("./features/auth/pages/Unauthorized"));
const NotFound = lazy(() => import("./features/auth/pages/NotFound"));
const ManageFoundations = lazy(() => import("./features/foundations/pages/ManageFoundations"));
const ManageAdmins = lazy(() => import("./features/admins/pages/ManageAdmins"));
const ManageEmployees = lazy(() => import("./features/employees/pages/ManageEmployees"));
const ProfilePage = lazy(() => import("./features/auth/pages/ProfilePage"));
const AuditLog = lazy(() => import("./features/audits/pages/AuditLog"));
const SettingsPage = lazy(() => import("./features/settings/pages/SettingsPage"));
const ManageActivities = lazy(() => import("./features/activities/pages/ManageActivities"));
const ManageExpenses = lazy(() => import("./features/expenses/pages/ManageExpenses"));
const ManageCategories = lazy(() => import("./features/categories/pages/ManageCategories"));
const ManageOtherIncome = lazy(() => import("./features/otherIncome/pages/ManageOtherIncome"));
const ManageFinancialYears = lazy(() =>
  import("./features/financialYears/pages/ManageFinancialYears")
);
const ManageBankAccounts = lazy(() =>
  import("./features/bankAccounts/pages/ManageBankAccounts")
);
const ManageTransactions = lazy(() =>
  import("./features/transactions/pages/ManageTransactions")
);
const AccountingDashboard = lazy(() =>
  import("./features/accounting/pages/AccountingDashboard")
);
const IncomeLedger = lazy(() =>
  import("./features/accounting/pages/IncomeLedger")
);
const ExpenseLedger = lazy(() =>
  import("./features/accounting/pages/ExpenseLedger")
);
const OtherIncomeLedger = lazy(() =>
  import("./features/accounting/pages/OtherIncomeLedger")
);
const CashBook = lazy(() => import("./features/accounting/pages/CashBook"));
const BankBook = lazy(() => import("./features/accounting/pages/BankBook"));
const AccountingReports = lazy(() =>
  import("./features/accounting/pages/AccountingReports")
);
const ManageTransfers = lazy(() =>
  import("./features/transfers/pages/ManageTransfers")
);

// Themed full-page fallback while a lazy chunk is loading.
const PageLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Spinner size="xl" />
  </div>
);

// Wraps a protected route element with an ErrorBoundary so a runtime
// error in one feature page doesn't blank the whole shell — the user
// keeps the sidebar/topbar and sees a "Try again" / "Go home" card.
const RouteBoundary = ({ children }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
);

const App = () => {
  return (
    <AuthProvider>
      <FinancialYearProvider>
        <Router>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* ─── Public ─────────────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* ─── Protected (Layout) ─────────────────────────────────────────── */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              {/* if we land on “/”, redirect to /dashboard */}
              <Route index element={<HomeRedirect />} />
              <Route
                path="dashboard"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <Dashboard />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="donor/add"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DONOR_CREATE}
                  >
                    <RouteBoundary>
                      <AddDonor />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="donation/add"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DONATION_CREATE}
                  >
                    <RouteBoundary>
                      <AddDonation />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="donation/search"
                element={
                  <PrivateRoute roles={[ROLES.ADMIN, ROLES.EMPLOYEE]}>
                    <RouteBoundary>
                      <SearchDonation />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="donor-history"
                element={
                  <PrivateRoute roles={[ROLES.ADMIN, ROLES.EMPLOYEE]}>
                    <RouteBoundary>
                      <DonorHistory />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              {/* Legacy /reports URL now redirects to the unified Manage
                  Donations workspace, which absorbed the bulk export/print
                  flow into its selection toolbar. Keeps old bookmarks alive. */}
              <Route
                path="reports"
                element={<Navigate to="/donation/search" replace />}
              />
              <Route
                path="foundations"
                element={
                  <PrivateRoute roles={[ROLES.SUPERADMIN]}>
                    <RouteBoundary>
                      <ManageFoundations />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="admins"
                element={
                  <PrivateRoute roles={[ROLES.SUPERADMIN]}>
                    <RouteBoundary>
                      <ManageAdmins />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="employees"
                element={
                  <PrivateRoute roles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
                    <RouteBoundary>
                      <ManageEmployees />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="audits"
                element={
                  <PrivateRoute roles={[ROLES.SUPERADMIN]}>
                    <RouteBoundary>
                      <AuditLog />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="activities"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                  >
                    <RouteBoundary>
                      <ManageActivities />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="expenses"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                  >
                    <RouteBoundary>
                      <ManageExpenses />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="categories"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN]}
                    perm={PERMISSIONS.CATEGORY_MANAGE}
                  >
                    <RouteBoundary>
                      <ManageCategories />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              {/* Legacy path kept alive → unified Categories screen. */}
              <Route path="expense-categories" element={<Navigate to="/categories" replace />} />
              <Route
                path="other-income"
                element={
                  <PrivateRoute roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}>
                    <RouteBoundary>
                      <ManageOtherIncome />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="settings/financial-years"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN]}
                    perm={PERMISSIONS.FINANCIAL_YEAR_MANAGE}
                  >
                    <RouteBoundary>
                      <ManageFinancialYears />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="settings/bank-accounts"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.BANK_ACCOUNT_VIEW}
                  >
                    <RouteBoundary>
                      <ManageBankAccounts />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="ledger"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.BANK_ACCOUNT_VIEW}
                  >
                    <RouteBoundary>
                      <ManageTransactions />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <AccountingDashboard />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/income"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <IncomeLedger />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/expense"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <ExpenseLedger />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/other-income"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <OtherIncomeLedger />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/cash-book"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <CashBook />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/bank-book"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <BankBook />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/reports"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.DASHBOARD_VIEW}
                  >
                    <RouteBoundary>
                      <AccountingReports />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="accounting/transfers"
                element={
                  <PrivateRoute
                    roles={[ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE]}
                    perm={PERMISSIONS.BANK_ACCOUNT_VIEW}
                  >
                    <RouteBoundary>
                      <ManageTransfers />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              {/* Profile is available to any authenticated user (ADMIN, SUPERADMIN,
                  and CUSTOMER all manage their own account here). */}
              <Route
                path="profile"
                element={
                  <PrivateRoute>
                    <RouteBoundary>
                      <ProfilePage />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <PrivateRoute>
                    <RouteBoundary>
                      <SettingsPage />
                    </RouteBoundary>
                  </PrivateRoute>
                }
              />
              {/* Fallback: any unmatched authenticated route → themed 404. */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* ─── Fallback (Public) ───────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </FinancialYearProvider>
    </AuthProvider>
  );
};

export default App;
