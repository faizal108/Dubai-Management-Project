// Receipt builder settings: defaults, option lists, and per-foundation
// resolution. Template render functions read the resolved settings; the
// builder UI edits them.

export const FONT_STACKS = {
  sans: "Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

export const FONT_OPTIONS = [
  { value: "sans", label: "Sans (Arial)" },
  { value: "serif", label: "Serif (Georgia)" },
  { value: "mono", label: "Mono (Courier)" },
];

// Body-text size multiplier applied by templates via scalePx().
export const FONT_SCALES = { compact: 0.9, normal: 1, large: 1.15 };
export const FONT_SCALE_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

export const LOGO_SIZES = { sm: 60, md: 90, lg: 130 };
export const LOGO_SIZE_OPTIONS = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];
export const LOGO_POSITION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
];

// Printable content width (px) by orientation — the print/PDF wrapper + the
// builder preview use this so layouts reflow sensibly for the page.
export const PAGE_WIDTHS = { portrait: 780, landscape: 1080 };
export const PAPER_OPTIONS = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
];
export const ORIENTATION_OPTIONS = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];
export const DATE_FORMAT_OPTIONS = [
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "dMy", label: "DD-MMM-YYYY" },
];

// Toggleable receipt fields (used by the builder + templates).
export const FIELD_TOGGLES = [
  { key: "receiptNo", label: "Receipt number" },
  { key: "donorAddress", label: "Donor address" },
  { key: "pan", label: "Donor PAN" },
  { key: "reference", label: "Payment reference (UTR / cheque)" },
  { key: "bankBranch", label: "Bank / branch" },
  { key: "amountInWords", label: "Amount in words" },
  { key: "logo", label: "Logo" },
  { key: "signature", label: "Signature / stamp" },
];

// The default declaration reproduces the original hard-coded 80G line so the
// classic template renders identically when a foundation hasn't customized it.
export const DEFAULT_RECEIPT_SETTINGS = {
  accentColor: "#F37021",
  textColor: "#1a1a1a",
  borderColor: "#009245", // outer frame; "none" to disable
  fontFamily: "sans",
  fontScale: "normal",
  headerTitle: "", // empty → foundation receipt/name
  receiptTitle: "", // empty → template default (e.g. "DONATION RECEIPT")
  declarationText:
    "This Donation is Eligible for Exemption Under Income Tax Act 1961 U/S 80GGC/80GGB",
  thankYouNote: "",
  contactNote: "",
  footerText: "", // empty → "for, <org>"
  signatureLabel: "", // empty → template default
  logoSize: "md",
  logoPosition: "left",
  paperSize: "a4",
  orientation: "portrait",
  dateFormat: "dmy",
  show: {
    receiptNo: true,
    donorAddress: true,
    pan: true,
    reference: true,
    bankBranch: true,
    amountInWords: true,
    logo: true,
    signature: true,
  },
};

// Merge a foundation's stored settings over the defaults (deep-merges `show`).
export function resolveReceiptSettings(foundation) {
  const s = foundation?.receiptSettings || {};
  return {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...s,
    show: { ...DEFAULT_RECEIPT_SETTINGS.show, ...(s.show || {}) },
  };
}

export const fontStackFor = (settings) =>
  FONT_STACKS[settings?.fontFamily] || FONT_STACKS.sans;

export const scaleFactor = (settings) =>
  FONT_SCALES[settings?.fontScale] ?? 1;

// Scale a base px size by the chosen font scale (rounded).
export const scalePx = (base, settings) =>
  Math.round(base * scaleFactor(settings));

export const logoWidthPx = (settings) =>
  LOGO_SIZES[settings?.logoSize] ?? LOGO_SIZES.md;

export const pageWidthPx = (settings) =>
  PAGE_WIDTHS[settings?.orientation] ?? PAGE_WIDTHS.portrait;
