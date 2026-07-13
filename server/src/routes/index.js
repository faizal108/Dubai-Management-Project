import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import foundationsRoutes from "../modules/foundations/foundations.routes.js";
import adminsRoutes from "../modules/admins/admins.routes.js";
import employeesRoutes from "../modules/employees/employees.routes.js";
import donorsRoutes from "../modules/donors/donors.routes.js";
import donationsRoutes from "../modules/donations/donations.routes.js";
import activitiesRoutes from "../modules/activities/activities.routes.js";
import expenseCategoriesRoutes from "../modules/expenseCategories/expenseCategories.routes.js";
import expensesRoutes from "../modules/expenses/expenses.routes.js";
import bankAccountsRoutes from "../modules/bankAccounts/bankAccounts.routes.js";
import transactionsRoutes from "../modules/transactions/transactions.routes.js";
import financialYearsRoutes from "../modules/financialYears/financialYears.routes.js";
import statsRoutes from "../modules/stats/stats.routes.js";
import accountingRoutes from "../modules/accounting/accounting.routes.js";
import auditsRoutes from "../modules/audits/audits.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/foundations", foundationsRoutes);
router.use("/admins", adminsRoutes);
router.use("/employees", employeesRoutes);
router.use("/donors", donorsRoutes);
router.use("/donations", donationsRoutes);
router.use("/activities", activitiesRoutes);
router.use("/expense-categories", expenseCategoriesRoutes);
router.use("/expenses", expensesRoutes);
router.use("/bank-accounts", bankAccountsRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/financial-years", financialYearsRoutes);
router.use("/stats", statsRoutes);
router.use("/accounting", accountingRoutes);
router.use("/audits", auditsRoutes);

export default router;
