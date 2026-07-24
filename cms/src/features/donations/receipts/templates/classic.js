// Classic receipt template — the original YIPP-style layout, parameterized by
// the receipt builder settings. With default settings it renders essentially
// the same as the pre-builder receipt.

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

  const orgNameHtml = orgName
    ? `<span style="color:${accent};">${esc(orgName)}</span>`
    : `YOUTH INDIA <span style="color:#009245;">PEACE PARTY</span>`;
  const sigLine = (settings.footerText && settings.footerText.trim())
    ? esc(settings.footerText)
    : `for, ${esc(orgName || "YOUTH INDIA PEACE PARTY")}`;
  const declaration = esc(settings.declarationText || "").replace(/\n/g, "<br/>");
  const centerLogo = settings.logoPosition === "center";

  const header = `
    <div style="display:flex; ${centerLogo ? "flex-direction:column; align-items:center; text-align:center;" : ""} padding:16px; gap:16px;">
      ${logoImgHtml(settings, logoSrc)}
      <div>
        <div style="font-size:${scalePx(32, settings)}px; line-height:1; color:${accent}; font-weight:bold;">${orgNameHtml}</div>
        <div style="font-size:${scalePx(12, settings)}px; margin-top:8px; line-height:1.3;">
          Reg No. ${esc(regNo)} • PAN No. ${esc(orgPan)}<br/>
          ${esc(orgAddress)}<br/>
          E-mail: ${esc(orgEmail)}
        </div>
      </div>
    </div>`;

  const title = (settings.receiptTitle && settings.receiptTitle.trim())
    ? `<div style="text-align:center; font-weight:bold; letter-spacing:1px; text-transform:uppercase; font-size:${scalePx(16, settings)}px; color:${accent}; margin:4px 0 8px;">${esc(settings.receiptTitle)}</div>`
    : "";

  const row = (inner) =>
    `<div style="display:flex; justify-content:space-between; margin-bottom:12px;">${inner}</div>`;

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(14, settings)}px;">
  ${header}
  ${title}
  <hr style="border:none; border-top:1px solid #000; margin:0 16px;" />
  <div style="padding:16px;">
    ${
      show.receiptNo !== false
        ? row(
            `<div style="display:flex;"><div><strong>Receipt No. Year ${new Date().getFullYear()} : </strong></div><div style="margin-left:5px;">${buildReceiptNo()}</div></div>
             <div style="display:flex;"><div><strong>Date : </strong></div><div style="border-bottom:1px solid #000; padding:2px 4px;">${formatReceiptDate(new Date().toISOString(), fmt)}</div></div>`
          )
        : ""
    }
    <div style="display:flex; margin-bottom:12px;">
      <div><strong>Received with thanks from Mr./Mrs./Ms.:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(d.donor?.fullName ?? d.donorNameSnapshot ?? "")}</div>
    </div>
    ${
      show.donorAddress !== false
        ? `<div style="display:flex; margin-bottom:12px;"><div><strong>Address:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(donorAddress(d))}</div></div>`
        : ""
    }
    <div style="display:flex; margin-bottom:12px; align-items:center;">
      ${
        show.pan !== false
          ? `<div style="margin-right:8px;"><strong>PAN No.:</strong></div><div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px; margin-right:16px;">${esc(d.donor?.pan ?? "")}</div>`
          : ""
      }
      ${
        show.amountInWords !== false
          ? `<div style="margin-right:8px;"><strong>The sum of Rupees:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px;">${esc(amountInWords(d.amount || 0))}</div>`
          : ""
      }
    </div>
    ${
      show.reference !== false
        ? row(`<div><strong>Towards donation by Cash/Cheque/D.D. No.:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(paymentRef(d))}</div>`)
        : ""
    }
    ${
      show.bankBranch !== false
        ? row(`<div><strong>Drawn on:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin:0 8px;">${esc(d.bankName ?? "")}</div><div><strong>Branch:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(d.ifsc ?? "")}</div>`)
        : ""
    }
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div style="display:flex;"><div style="margin-right:8px;"><strong>Date : </strong></div><div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px;">${formatReceiptDate(d.donationDate, fmt)}</div></div>
      <div style="text-align:center; margin-top:10px;">
        <strong>${sigLine}</strong>
        ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(11, settings)}px; color:#555; margin-top:2px;">${esc(settings.signatureLabel)}</div>` : ""}
      </div>
    </div>
    <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center;">
        <div style="display:flex; align-items:center; border:2px solid ${accent}; width:200px;">
          <div style="width:40px; height:40px; background-color:${accent}; color:white; font-size:24px; display:flex; align-items:center; justify-content:center;">&#8377;</div>
          <div style="width:100%; font-size:1.3rem; padding:2px; text-align:center;"><strong>${esc(d.amount ?? "")}</strong> /-</div>
        </div>
        ${declaration ? `<div style="font-size:${scalePx(15, settings)}px; text-align:center; font-weight:bold; line-height:115%; margin-left:5px;">${declaration}</div>` : ""}
      </div>
      <div style="position:absolute; bottom:-30px; right:30px;">${stampImgHtml(settings, stampSrc, 130)}</div>
    </div>
    ${settings.thankYouNote && settings.thankYouNote.trim() ? `<div style="text-align:center; margin-top:40px; font-style:italic; color:${accent};">${esc(settings.thankYouNote)}</div>` : ""}
    ${settings.contactNote && settings.contactNote.trim() ? `<div style="text-align:center; margin-top:8px; font-size:${scalePx(11, settings)}px; color:#666;">${esc(settings.contactNote)}</div>` : ""}
  </div>
  </div>
`;
}

export default {
  id: "classic",
  name: "Classic",
  description: "Traditional two-column header with underlined fields and an accent amount box.",
  render,
};
