// Compact receipt template — dense single block that fits ~half a page. Good
// for high-volume printing / saving paper.

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

  const cell = (label, value) =>
    value
      ? `<span style="margin-right:16px;"><span style="color:#888;">${esc(label)}:</span> <strong>${esc(value)}</strong></span>`
      : "";

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(12, settings)}px; padding:14px 18px; border:1px solid ${accent};">
    <div style="display:flex; align-items:center; gap:12px; ${settings.logoPosition === "center" ? "flex-direction:column; text-align:center;" : ""}">
      ${logoImgHtml(settings, logoSrc)}
      <div style="flex:1;">
        <div style="font-size:${scalePx(18, settings)}px; font-weight:700; color:${accent};">${esc(title)}</div>
        <div style="font-size:${scalePx(10, settings)}px; color:#777;">Reg ${esc(regNo)} · PAN ${esc(orgPan)} · ${esc(orgEmail)}</div>
      </div>
      <div style="text-align:right;">
        <div style="text-transform:uppercase; letter-spacing:1px; font-size:${scalePx(10, settings)}px; color:${accent}; font-weight:700;">${receiptTitle}</div>
        ${show.receiptNo !== false ? `<div style="font-size:${scalePx(11, settings)}px;">No. ${buildReceiptNo()}</div>` : ""}
        <div style="font-size:${scalePx(11, settings)}px;">${formatReceiptDate(d.donationDate || new Date().toISOString(), fmt)}</div>
      </div>
    </div>

    <div style="border-top:1px dashed #ccc; margin:10px 0;"></div>

    <div style="line-height:1.9;">
      ${cell("Received from", d.donor?.fullName ?? d.donorNameSnapshot ?? "")}
      ${show.pan !== false ? cell("PAN", d.donor?.pan ?? "") : ""}
      ${show.donorAddress !== false ? cell("Address", donorAddress(d)) : ""}
      ${show.reference !== false ? cell("Ref", paymentRef(d)) : ""}
      ${show.bankBranch !== false ? cell("Bank", [d.bankName, d.ifsc].filter(Boolean).join(" / ")) : ""}
    </div>

    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
      <div>
        <span style="border:1.5px solid ${accent}; padding:3px 10px; font-size:${scalePx(16, settings)}px; font-weight:800; color:${accent};">&#8377;${esc(d.amount ?? "")}</span>
        ${show.amountInWords !== false ? `<span style="font-style:italic; color:#666; margin-left:8px; font-size:${scalePx(11, settings)}px;">${esc(amountInWords(d.amount || 0))}</span>` : ""}
      </div>
      <div style="text-align:center;">
        ${stampImgHtml(settings, stampSrc, 56)}
        <div style="font-size:${scalePx(11, settings)}px; font-weight:600;">${sigLine}</div>
        ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(9, settings)}px; color:#888;">${esc(settings.signatureLabel)}</div>` : ""}
      </div>
    </div>

    ${declaration ? `<div style="margin-top:8px; font-size:${scalePx(10, settings)}px; color:#666;">${declaration}</div>` : ""}
    ${settings.thankYouNote && settings.thankYouNote.trim() ? `<div style="margin-top:4px; font-size:${scalePx(10, settings)}px; font-style:italic; color:${accent};">${esc(settings.thankYouNote)}</div>` : ""}
    ${settings.contactNote && settings.contactNote.trim() ? `<div style="margin-top:4px; font-size:${scalePx(9, settings)}px; color:#999;">${esc(settings.contactNote)}</div>` : ""}
  </div>
`;
}

export default {
  id: "compact",
  name: "Compact (half page)",
  description: "Dense single-block layout that fits about half a page — ideal for high-volume printing.",
  render,
};
