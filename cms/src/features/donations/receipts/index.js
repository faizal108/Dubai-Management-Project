// Receipt template registry. Each template is a code module exporting
// { id, name, description, render({ donation, foundation, settings }) }.
// Add a new template by dropping a module in ./templates and registering it
// here — it appears in the builder gallery automatically (no backend change).

import classic from "./templates/classic.js";
import modern from "./templates/modern.js";
import minimal from "./templates/minimal.js";
import elegant from "./templates/elegant.js";
import compact from "./templates/compact.js";

export const RECEIPT_TEMPLATES = [classic, modern, minimal, elegant, compact];
export const DEFAULT_TEMPLATE_ID = "classic";

const BY_ID = Object.fromEntries(RECEIPT_TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id) => BY_ID[id] || BY_ID[DEFAULT_TEMPLATE_ID];

// Render a receipt to an HTML string using the given template id + context.
export function renderReceipt(templateId, ctx) {
  return getTemplate(templateId).render(ctx);
}

export {
  resolveReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  LOGO_SIZE_OPTIONS,
  LOGO_POSITION_OPTIONS,
  PAPER_OPTIONS,
  ORIENTATION_OPTIONS,
  DATE_FORMAT_OPTIONS,
  FIELD_TOGGLES,
  pageWidthPx,
} from "./settings.js";

// Sample donation used by the builder's live preview.
export const SAMPLE_DONATION = {
  id: "sample",
  amount: "5100",
  type: "CHEQUE",
  chequeNumber: "004521",
  utr: "",
  bankName: "State Bank of India",
  ifsc: "Ashram Road",
  donationDate: new Date().toISOString(),
  donor: {
    fullName: "Ramesh Kumar",
    pan: "ABCDE1234F",
    address1: "12 Gandhi Marg",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
  },
};
