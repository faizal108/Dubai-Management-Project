// Modern receipt template — an accent header band, a clean label/value grid,
// a highlighted amount, and a signature block.

import {
  esc,
  formatReceiptDate,
  buildReceiptNo,
  amountInWords,
  resolveOrg,
  paymentRef,
  donorAddress,
  logoImgHtml,
  stampImgHtml,
} from "../shared.js";
import { fontStackFor, scalePx } from "../settings.js";

function render({ donation: d, foundation, settings }) {
  const accent = settings.accentColor || "#F37021";
  const text = settings.textColor || "#1a1a1a";
  const font = fontStackFor(settings);
  const fmt = settings.dateFormat;
  const show = settings.show || {};
  const { logoSrc, stampSrc, orgName, regNo, orgPan, orgAddress, orgEmail } =
    resolveOrg(foundation, settings);
  const title = orgName || "YOUTH INDIA PEACE PARTY";
  const declaration = esc(settings.declarationText || "").replace(/\n/g, "<br/>");
  const sigLine = (settings.footerText && settings.footerText.trim())
    ? esc(settings.footerText)
    : `For ${esc(title)}`;
  const receiptTitle = (settings.receiptTitle && settings.receiptTitle.trim())
    ? esc(settings.receiptTitle)
    : "Donation Receipt";

  const line = (label, value) =>
    `<tr>
      <td style="padding:6px 12px 6px 0; color:#666; white-space:nowrap; vertical-align:top;">${esc(label)}</td>
      <td style="padding:6px 0; font-weight:600; border-bottom:1px solid #eee;">${esc(value || "—")}</td>
    </tr>`;

  const rows = [
    show.receiptNo !== false ? line("Receipt No.", buildReceiptNo()) : "",
    line("Date", formatReceiptDate(d.donationDate || new Date().toISOString(), fmt)),
    line("Received from", d.donor?.fullName ?? d.donorNameSnapshot ?? ""),
    show.donorAddress !== false ? line("Address", donorAddress(d)) : "",
    show.pan !== false ? line("PAN", d.donor?.pan ?? "") : "",
    show.reference !== false ? line("Payment ref.", paymentRef(d)) : "",
    show.bankBranch !== false ? line("Bank / Branch", [d.bankName, d.ifsc].filter(Boolean).join(" / ")) : "",
  ].join("");

  const logo = logoImgHtml(settings, logoSrc, "background:#fff; border-radius:8px; padding:4px;");

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(14, settings)}px;">
    <div style="background:${accent}; color:#fff; padding:20px 24px; display:flex; align-items:center; ${settings.logoPosition === "center" ? "flex-direction:column; text-align:center;" : ""} gap:16px;">
      ${logo}
      <div>
        <div style="font-size:${scalePx(26, settings)}px; font-weight:800; line-height:1.1;">${esc(title)}</div>
        <div style="font-size:${scalePx(11, settings)}px; opacity:.9; margin-top:4px;">
          Reg No. ${esc(regNo)} • PAN ${esc(orgPan)}<br/>
          ${esc(orgAddress)} • ${esc(orgEmail)}
        </div>
      </div>
    </div>

    <div style="padding:24px;">
      <div style="text-transform:uppercase; letter-spacing:1px; font-size:${scalePx(12, settings)}px; color:${accent}; font-weight:700; margin-bottom:12px;">
        ${receiptTitle}
      </div>

      <div style="display:flex; gap:24px; align-items:flex-start;">
        <table style="border-collapse:collapse; font-size:${scalePx(14, settings)}px; flex:1;">${rows}</table>
        <div style="width:220px; text-align:center; border:2px solid ${accent}; border-radius:10px; padding:16px;">
          <div style="font-size:${scalePx(11, settings)}px; color:#666; text-transform:uppercase;">Amount</div>
          <div style="font-size:${scalePx(30, settings)}px; font-weight:800; color:${accent};">&#8377;${esc(d.amount ?? "")}</div>
          ${show.amountInWords !== false ? `<div style="font-size:${scalePx(11, settings)}px; color:#666; margin-top:6px; font-style:italic;">${esc(amountInWords(d.amount || 0))}</div>` : ""}
        </div>
      </div>

      ${declaration ? `<div style="margin-top:18px; padding:10px 14px; background:${accent}1a; border-left:3px solid ${accent}; font-size:${scalePx(12, settings)}px; font-weight:600;">${declaration}</div>` : ""}
      ${settings.thankYouNote && settings.thankYouNote.trim() ? `<div style="margin-top:14px; font-style:italic; color:${accent};">${esc(settings.thankYouNote)}</div>` : ""}

      <div style="display:flex; justify-content:flex-end; align-items:flex-end; margin-top:24px;">
        <div style="text-align:center;">
          ${stampImgHtml(settings, stampSrc, 90)}
          <div style="border-top:1px solid #333; margin-top:4px; padding-top:4px; font-size:${scalePx(12, settings)}px; font-weight:700;">${sigLine}</div>
          ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(10, settings)}px; color:#666;">${esc(settings.signatureLabel)}</div>` : ""}
        </div>
      </div>

      ${settings.contactNote && settings.contactNote.trim() ? `<div style="text-align:center; margin-top:16px; font-size:${scalePx(11, settings)}px; color:#666;">${esc(settings.contactNote)}</div>` : ""}
    </div>
  </div>
`;
}

export default {
  id: "modern",
  name: "Modern",
  description: "Accent header band, a clean label/value grid, and a highlighted amount card.",
  render,
};
