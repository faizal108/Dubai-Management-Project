// Shared helpers for receipt templates: formatters, HTML escaping, and
// resolution of the organisation header details (foundation branding with the
// bundled YIPP assets/text as fallback).

import logoUrl from "../../../assets/receipt-logo.png";
import YYIP_Stamp from "../../../assets/YYIP-STAMP.png";
import { convertNumberToWords } from "../../../lib/convertNumberToWords";
import { logoWidthPx } from "./settings.js";

export const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export const formatDdMmYyyy = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Date formatter honoring the builder's dateFormat setting.
//   "dmy" → 14/07/2026   "dMy" → 14-Jul-2026
export const formatReceiptDate = (iso, fmt = "dmy") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  if (fmt === "dMy") return `${day}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

export const buildReceiptNo = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    pad(d.getFullYear() % 100) + pad(d.getMonth() + 1) + pad(d.getDate()) +
    pad(d.getHours()) + pad(d.getMinutes())
  );
};

export const amountInWords = (num) => {
  const safe = Number.isFinite(Number(num)) ? Math.floor(Number(num)) : 0;
  return `${convertNumberToWords(safe)} only`;
};

// Escape user-supplied text before inlining into the receipt HTML.
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// Resolve org header details from foundation branding, falling back to the
// bundled YIPP defaults so an unconfigured tenant still prints a valid receipt.
export function resolveOrg(foundation, settings) {
  const orgName =
    (settings?.headerTitle && settings.headerTitle.trim()) ||
    foundation?.receiptName ||
    foundation?.name ||
    null;
  return {
    logoSrc: foundation?.logoUrl || logoUrl,
    stampSrc: foundation?.signatureUrl || YYIP_Stamp,
    orgName,
    regNo: foundation?.registrationNumber || "56/111/LET/ECI/FUNC/PP/PPS-I/2018",
    orgPan: foundation?.pan || "AAABY1207D",
    orgAddress:
      foundation?.address ||
      "5th Floor, Awning No.24 Road Side Ajanta Center, Ashram Road, Ahmedabad-380009",
    orgEmail: foundation?.email || "yipp79@gmail.com",
  };
}

// Donor payment reference for the "by cash/cheque/DD" line.
export const paymentRef = (d) =>
  (d?.type === "CHEQUE" ? d?.chequeNumber : d?.utr) ?? "";

export const donorAddress = (d) =>
  [d?.donor?.address1, d?.donor?.city, d?.donor?.state, d?.donor?.country]
    .filter(Boolean)
    .join(", ");

// Logo <img> honoring the show.logo toggle + logoSize. Returns "" when hidden.
export function logoImgHtml(settings, logoSrc, extraStyle = "") {
  if (settings?.show?.logo === false) return "";
  const w = logoWidthPx(settings);
  return `<img src="${logoSrc}" alt="Logo" style="width:${w}px; max-height:${w}px; object-fit:contain; ${extraStyle}" />`;
}

// Signature/stamp <img> honoring show.signature. Returns "" when hidden.
export function stampImgHtml(settings, stampSrc, size = 120, extraStyle = "") {
  if (settings?.show?.signature === false) return "";
  return `<img src="${stampSrc}" height="${size}" width="${size}" alt="Signature" style="object-fit:contain; ${extraStyle}" />`;
}
