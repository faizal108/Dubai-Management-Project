// Minimal receipt template — borderless, generous whitespace, small logo,
// understated typography. A modern NGO look.

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
    : "Receipt";

  const kv = (label, value) =>
    value
      ? `<div style="margin-bottom:10px;"><span style="color:#999; font-size:${scalePx(11, settings)}px; text-transform:uppercase; letter-spacing:.5px;">${esc(label)}</span><br/><span style="font-weight:600;">${esc(value)}</span></div>`
      : "";

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(14, settings)}px; padding:40px 48px;">
    <div style="display:flex; align-items:center; justify-content:space-between; ${settings.logoPosition === "center" ? "flex-direction:column; gap:12px; text-align:center;" : ""}">
      <div>
        <div style="font-size:${scalePx(22, settings)}px; font-weight:700; color:${accent};">${esc(title)}</div>
        <div style="font-size:${scalePx(11, settings)}px; color:#888; margin-top:4px;">Reg ${esc(regNo)} · PAN ${esc(orgPan)}</div>
      </div>
      ${logoImgHtml(settings, logoSrc)}
    </div>

    <div style="height:1px; background:#eee; margin:28px 0;"></div>

    <div style="text-transform:uppercase; letter-spacing:2px; font-size:${scalePx(12, settings)}px; color:#999; margin-bottom:20px;">${receiptTitle}</div>

    <div style="display:flex; gap:48px;">
      <div style="flex:1;">
        ${kv("Received from", d.donor?.fullName ?? d.donorNameSnapshot ?? "")}
        ${show.donorAddress !== false ? kv("Address", donorAddress(d)) : ""}
        ${show.pan !== false ? kv("PAN", d.donor?.pan ?? "") : ""}
      </div>
      <div style="flex:1;">
        ${show.receiptNo !== false ? kv("Receipt no.", buildReceiptNo()) : ""}
        ${kv("Date", formatReceiptDate(d.donationDate || new Date().toISOString(), fmt))}
        ${show.reference !== false ? kv("Payment ref.", paymentRef(d)) : ""}
        ${show.bankBranch !== false ? kv("Bank / branch", [d.bankName, d.ifsc].filter(Boolean).join(" / ")) : ""}
      </div>
    </div>

    <div style="margin-top:24px; padding:20px 24px; background:#fafafa; border-radius:12px;">
      <span style="color:#999; font-size:${scalePx(11, settings)}px; text-transform:uppercase;">Amount donated</span>
      <div style="font-size:${scalePx(34, settings)}px; font-weight:800; color:${accent};">&#8377;${esc(d.amount ?? "")}</div>
      ${show.amountInWords !== false ? `<div style="font-size:${scalePx(12, settings)}px; color:#888; font-style:italic;">${esc(amountInWords(d.amount || 0))}</div>` : ""}
    </div>

    ${declaration ? `<div style="margin-top:20px; font-size:${scalePx(12, settings)}px; color:#666;">${declaration}</div>` : ""}
    ${settings.thankYouNote && settings.thankYouNote.trim() ? `<div style="margin-top:16px; font-style:italic; color:${accent};">${esc(settings.thankYouNote)}</div>` : ""}

    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:40px;">
      <div style="font-size:${scalePx(11, settings)}px; color:#999;">${esc(orgEmail)} · ${esc(orgAddress)}</div>
      <div style="text-align:center;">
        ${stampImgHtml(settings, stampSrc, 80)}
        <div style="margin-top:4px; font-size:${scalePx(12, settings)}px; font-weight:600;">${sigLine}</div>
        ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(10, settings)}px; color:#999;">${esc(settings.signatureLabel)}</div>` : ""}
      </div>
    </div>
    ${settings.contactNote && settings.contactNote.trim() ? `<div style="text-align:center; margin-top:16px; font-size:${scalePx(11, settings)}px; color:#aaa;">${esc(settings.contactNote)}</div>` : ""}
  </div>
`;
}

export default {
  id: "minimal",
  name: "Minimal",
  description: "Borderless, airy layout with a soft amount panel — a clean modern look.",
  render,
};
