// Elegant / Formal receipt template — centered header, decorative rule lines,
// a framed body. A traditional "certificate" feel (serif reads best).

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
  const accent = settings.accentColor || "#7a5c1e";
  const text = settings.textColor || "#2a2a2a";
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

  const rule = `<div style="display:flex; align-items:center; justify-content:center; gap:10px; margin:10px 0;">
      <div style="height:1px; width:60px; background:${accent};"></div>
      <div style="color:${accent};">&#10086;</div>
      <div style="height:1px; width:60px; background:${accent};"></div>
    </div>`;

  const kv = (label, value) =>
    value
      ? `<tr><td style="padding:5px 14px 5px 0; text-align:right; color:#777; white-space:nowrap;">${esc(label)}</td><td style="padding:5px 0; font-weight:600;">${esc(value)}</td></tr>`
      : "";

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(14, settings)}px; padding:24px;">
    <div style="border:2px solid ${accent}; padding:28px 32px;">
      <div style="text-align:center;">
        ${logoImgHtml(settings, logoSrc, "margin:0 auto 10px;")}
        <div style="font-size:${scalePx(28, settings)}px; font-weight:700; color:${accent}; letter-spacing:.5px;">${esc(title)}</div>
        <div style="font-size:${scalePx(11, settings)}px; color:#777; margin-top:6px;">Reg No. ${esc(regNo)} • PAN ${esc(orgPan)}<br/>${esc(orgAddress)}</div>
      </div>
      ${rule}
      <div style="text-align:center; text-transform:uppercase; letter-spacing:3px; font-size:${scalePx(15, settings)}px; color:${accent}; margin-bottom:16px;">${receiptTitle}</div>

      <table style="margin:0 auto; border-collapse:collapse; font-size:${scalePx(14, settings)}px;">
        ${kv("Received from", d.donor?.fullName ?? d.donorNameSnapshot ?? "")}
        ${show.donorAddress !== false ? kv("Address", donorAddress(d)) : ""}
        ${show.pan !== false ? kv("PAN", d.donor?.pan ?? "") : ""}
        ${show.receiptNo !== false ? kv("Receipt No.", buildReceiptNo()) : ""}
        ${kv("Date", formatReceiptDate(d.donationDate || new Date().toISOString(), fmt))}
        ${show.reference !== false ? kv("Payment ref.", paymentRef(d)) : ""}
        ${show.bankBranch !== false ? kv("Bank / Branch", [d.bankName, d.ifsc].filter(Boolean).join(" / ")) : ""}
      </table>

      <div style="text-align:center; margin:20px 0;">
        <div style="display:inline-block; border-top:2px solid ${accent}; border-bottom:2px solid ${accent}; padding:8px 28px;">
          <span style="font-size:${scalePx(12, settings)}px; color:#777;">Amount</span>
          <span style="font-size:${scalePx(26, settings)}px; font-weight:800; color:${accent}; margin-left:10px;">&#8377;${esc(d.amount ?? "")}</span>
        </div>
        ${show.amountInWords !== false ? `<div style="font-style:italic; color:#666; margin-top:8px;">(${esc(amountInWords(d.amount || 0))})</div>` : ""}
      </div>

      ${declaration ? `<div style="text-align:center; font-size:${scalePx(12, settings)}px; color:#555; margin-bottom:8px;">${declaration}</div>` : ""}
      ${settings.thankYouNote && settings.thankYouNote.trim() ? `<div style="text-align:center; font-style:italic; color:${accent}; margin-bottom:8px;">${esc(settings.thankYouNote)}</div>` : ""}

      <div style="display:flex; justify-content:flex-end; margin-top:24px;">
        <div style="text-align:center;">
          ${stampImgHtml(settings, stampSrc, 100)}
          <div style="border-top:1px solid ${accent}; margin-top:4px; padding-top:4px; font-weight:600;">${sigLine}</div>
          ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(10, settings)}px; color:#777;">${esc(settings.signatureLabel)}</div>` : ""}
        </div>
      </div>
      ${settings.contactNote && settings.contactNote.trim() ? `<div style="text-align:center; margin-top:12px; font-size:${scalePx(11, settings)}px; color:#999;">${esc(settings.contactNote)} · ${esc(orgEmail)}</div>` : `<div style="text-align:center; margin-top:12px; font-size:${scalePx(11, settings)}px; color:#999;">${esc(orgEmail)}</div>`}
    </div>
  </div>
`;
}

export default {
  id: "elegant",
  name: "Elegant / Formal",
  description: "Centered header, decorative rules and a framed body — a certificate feel (best with a serif font).",
  render,
};
