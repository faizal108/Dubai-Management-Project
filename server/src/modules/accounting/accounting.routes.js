import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../lib/permissions.js";
import {
  accountingSummaryQuerySchema,
  ledgerListQuerySchema,
  bookListQuerySchema,
  reportsQuerySchema,
} from "./accounting.schema.js";
import {
  summaryHandler,
  incomeLedgerHandler,
  expenseLedgerHandler,
  cashBookHandler,
  bankBookHandler,
  reportsHandler,
} from "./accounting.controller.js";

const router = Router();

// Accounting views are read-only aggregates over the append-only ledger.
// Access mirrors the operational dashboard: ADMIN/SUPERADMIN pass through,
// EMPLOYEEs need DASHBOARD_VIEW so the same trusted roster that can see
// KPIs can see the accounting rollups.
router.use(
  authenticate,
  authorize("ADMIN", "SUPERADMIN", "EMPLOYEE"),
  requirePermission(PERMISSIONS.DASHBOARD_VIEW)
);

router.get(
  "/summary",
  validate({ query: accountingSummaryQuerySchema }),
  summaryHandler
);

// Income / expense ledger listings. Both accept the same paged filter shape
// (foundation, FY, bank account, date window); the split is by transaction
// type in the service layer.
router.get(
  "/ledger/income",
  validate({ query: ledgerListQuerySchema }),
  incomeLedgerHandler
);
router.get(
  "/ledger/expense",
  validate({ query: ledgerListQuerySchema }),
  expenseLedgerHandler
);

// Cash / Bank book listings. Chronological with running balances derived
// from Transaction.balanceAfter; the cash-vs-bank split is a predicate on
// bankAccount.accountNumber (null => cash).
router.get(
  "/books/cash",
  validate({ query: bookListQuerySchema }),
  cashBookHandler
);
router.get(
  "/books/bank",
  validate({ query: bookListQuerySchema }),
  bankBookHandler
);

// Reports endpoint. Unpaginated per-account opening/closing statement.
router.get(
  "/reports",
  validate({ query: reportsQuerySchema }),
  reportsHandler
);

export default router;
