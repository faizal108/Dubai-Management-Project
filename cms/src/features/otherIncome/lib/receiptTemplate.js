// src/features/otherIncome/lib/receiptTemplate.js
//
// In-kind ("Other Donation") receipt rendering + single-record print/PDF
// helpers. Mirrors donations/lib/receiptTemplate.js in shape, reusing the
// same org-branding + shared formatters so both receipt kinds look like
// they come from one system — but a dedicated (non-configurable) template
// rather than the full 5-template donation registry, since in-kind receipts
// have a materially different field set (item/qty/unit instead of amount)
// and don't need per-foundation template switching.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import { resolveReceiptSettings, pageWidthPx, fontStackFor, scalePx } from "../../donations/receipts/settings.js";
import { esc, formatReceiptDate, buildReceiptNo, resolveOrg, logoImgHtml, stampImgHtml } from "../../donations/receipts/shared.js";

function pageGeometry(foundation) {
  const s = resolveReceiptSettings(foundation);
  return {
    width: pageWidthPx(s),
    border: s.borderColor === "none" ? "none" : `8px solid ${s.borderColor || "#009245"}`,
    paper: s.paperSize === "letter" ? "letter" : "a4",
    orientation: s.orientation === "landscape" ? "landscape" : "portrait",
  };
}

const fmtValue = (v) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Renders a single in-kind receipt to an HTML string using the foundation's
// receipt-builder branding/settings (logo, org header, accent color) so it
// visually matches donation receipts without needing its own builder.
export const buildOtherIncomeReceiptHtml = (r, foundation = null) => {
  const settings = resolveReceiptSettings(foundation);
  const accent = settings.accentColor || "#F37021";
  const text = settings.textColor || "#1a1a1a";
  const font = fontStackFor(settings);
  const fmt = settings.dateFormat;
  const { logoSrc, stampSrc, orgName, regNo, orgPan, orgAddress, orgEmail } = resolveOrg(foundation, settings);

  const orgNameHtml = orgName
    ? `<span style="color:${accent};">${esc(orgName)}</span>`
    : `YOUTH INDIA <span style="color:#009245;">PEACE PARTY</span>`;
  const sigLine = settings.footerText && settings.footerText.trim()
    ? esc(settings.footerText)
    : `for, ${esc(orgName || "YOUTH INDIA PEACE PARTY")}`;
  const centerLogo = settings.logoPosition === "center";

  const donorName = r.donor?.fullName ?? r.donorName ?? r.donorNameSnapshot ?? "";
  const qtyLine = `${Number(r.quantity ?? 0)}${r.unit ? " " + r.unit : ""}`;
  const estValueLine = r.estimatedValue != null ? `₹${fmtValue(r.estimatedValue)}` : null;

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

  const title = `<div style="text-align:center; font-weight:bold; letter-spacing:1px; text-transform:uppercase; font-size:${scalePx(16, settings)}px; color:${accent}; margin:4px 0 8px;">In-Kind Donation Receipt</div>`;

  const row = (inner) => `<div style="display:flex; justify-content:space-between; margin-bottom:12px;">${inner}</div>`;

  return `
  <div style="font-family:${font}; color:${text}; font-size:${scalePx(14, settings)}px;">
  ${header}
  ${title}
  <hr style="border:none; border-top:1px solid #000; margin:0 16px;" />
  <div style="padding:16px;">
    ${row(
      `<div style="display:flex;"><div><strong>Receipt No. Year ${new Date().getFullYear()} : </strong></div><div style="margin-left:5px;">${buildReceiptNo()}</div></div>
       <div style="display:flex;"><div><strong>Date : </strong></div><div style="border-bottom:1px solid #000; padding:2px 4px;">${formatReceiptDate(new Date().toISOString(), fmt)}</div></div>`
    )}
    <div style="display:flex; margin-bottom:12px;">
      <div><strong>Received with thanks from Mr./Mrs./Ms.:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(donorName) || "Anonymous"}</div>
    </div>
    <div style="display:flex; margin-bottom:12px;">
      <div><strong>Item(s) received:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${esc(r.itemName)}</div>
    </div>
    <div style="display:flex; margin-bottom:12px; align-items:center;">
      <div style="margin-right:8px;"><strong>Quantity:</strong></div>
      <div style="min-width:120px; border-bottom:1px solid #000; padding:2px 4px; margin-right:16px;">${esc(qtyLine)}</div>
      ${r.categoryName ? `<div style="margin-right:8px;"><strong>Category:</strong></div><div style="flex:1; border-bottom:1px solid #000; padding:2px 4px;">${esc(r.categoryName)}</div>` : ""}
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div style="display:flex;"><div style="margin-right:8px;"><strong>Received on : </strong></div><div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px;">${formatReceiptDate(r.receivedOn, fmt)}</div></div>
      <div style="text-align:center; margin-top:10px;">
        <strong>${sigLine}</strong>
        ${settings.signatureLabel && settings.signatureLabel.trim() ? `<div style="font-size:${scalePx(11, settings)}px; color:#555; margin-top:2px;">${esc(settings.signatureLabel)}</div>` : ""}
      </div>
    </div>
    ${r.notes ? `<div style="margin-bottom:12px;"><strong>Notes:</strong> ${esc(r.notes)}</div>` : ""}
    <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; border:2px solid ${accent}; min-width:220px;">
        <div style="width:40px; height:40px; background-color:${accent}; color:white; font-size:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">&#127873;</div>
        <div style="width:100%; font-size:1rem; padding:6px 10px;">
          <strong>${esc(r.itemName)}</strong> &times; ${esc(qtyLine)}
          ${estValueLine ? `<div style="font-size:${scalePx(11, settings)}px; color:#555;">Est. value: ${estValueLine} (informational only, not counted as cash)</div>` : ""}
        </div>
      </div>
      <div style="position:absolute; bottom:-30px; right:30px;">${stampImgHtml(settings, stampSrc, 130)}</div>
    </div>
    <div style="text-align:center; margin-top:40px; font-style:italic; color:${accent};">${esc(settings.thankYouNote?.trim() || "Thank you for your generous in-kind contribution.")}</div>
  </div>
  </div>`;
};

// Print a single in-kind receipt via a hidden iframe, same approach as
// donations/lib/receiptTemplate.js's printReceipts (host page keeps state).
export const printOtherIncomeReceipt = (record, foundation = null) =>
  new Promise((resolve) => {
    const geo = pageGeometry(foundation);
    const style = `body{margin:0;font-family:Arial,sans-serif;}
      @page{size:${geo.paper} ${geo.orientation};margin:8mm;}
      .receipt{width:${geo.width}px;margin:20px auto;border:${geo.border};padding:0;box-sizing:border-box;}`;
    const fullHtml = `<html><head><title>In-Kind Donation Receipt</title><style>${style}</style></head><body><div class="receipt">${buildOtherIncomeReceiptHtml(record, foundation)}</div></body></html>`;
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "absolute", width: 0, height: 0, border: "none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(fullHtml); doc.close();
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { document.body.removeChild(iframe); resolve(); }, 500);
    };
  });

// Generate a single-page PDF for one in-kind receipt.
export const saveOtherIncomeReceiptPdf = async (record, foundation = null) => {
  const geo = pageGeometry(foundation);
  const pdf = new jsPDF({ unit: "pt", format: geo.paper, orientation: geo.orientation });
  const el = document.createElement("div");
  Object.assign(el.style, { position: "absolute", top: "-9999px", left: "-9999px", width: `${geo.width}px`, margin: "0", border: geo.border, padding: "0", boxSizing: "border-box", background: "#fff", zIndex: "-1000" });
  el.innerHTML = buildOtherIncomeReceiptHtml(record, foundation);
  document.body.appendChild(el);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: null });
  const imgData = canvas.toDataURL("image/png");
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = (canvas.height * pdfW) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
  document.body.removeChild(el);
  const ts = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
  pdf.save(`in-kind-receipt_${ts}.pdf`);
};
