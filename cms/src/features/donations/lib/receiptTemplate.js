// src/features/donations/lib/receiptTemplate.js
// Shared receipt rendering + bulk export helpers. Consumed by the donation
// management page (and any future caller) so the HTML/PDF/CSV plumbing
// doesn't get duplicated across screens.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import { renderReceipt, resolveReceiptSettings, DEFAULT_TEMPLATE_ID, pageWidthPx } from "../receipts";
import { formatAmount as fmtAmount, formatReceiptDate, buildReceiptNo as bldNo } from "../receipts/shared";

// Re-exported for back-compat with existing importers.
export const formatAmount = fmtAmount;
export const formatDdMmYyyy = (iso) => formatReceiptDate(iso, "dmy");
export const buildReceiptNo = bldNo;

// Resolve the print/PDF page geometry from a foundation's receipt settings.
function pageGeometry(foundation) {
  const s = resolveReceiptSettings(foundation);
  return {
    width: pageWidthPx(s),
    border: s.borderColor === "none" ? "none" : `8px solid ${s.borderColor || "#009245"}`,
    paper: s.paperSize === "letter" ? "letter" : "a4",
    orientation: s.orientation === "landscape" ? "landscape" : "portrait",
  };
}

// Renders a single donation receipt to an HTML string using the foundation's
// active template + settings (the receipt builder). Falls back to the classic
// template + defaults when the foundation hasn't configured anything.
export const buildReceiptHtml = (d, foundation = null) =>
  renderReceipt(foundation?.receiptTemplateId || DEFAULT_TEMPLATE_ID, {
    donation: d,
    foundation,
    settings: resolveReceiptSettings(foundation),
  });

// Print receipts via a hidden iframe so the host page doesn't lose state.
export const printReceipts = (records, foundation = null) =>
  new Promise((resolve) => {
    const geo = pageGeometry(foundation);
    const style = `body{margin:0;font-family:Arial,sans-serif;}
      @page{size:${geo.paper} ${geo.orientation};margin:8mm;}
      .receipt{width:${geo.width}px;margin:20px auto;border:${geo.border};padding:0;box-sizing:border-box;page-break-after:always;}`;
    const fullHtml = `<html><head><title>Batch Donation Receipts</title><style>${style}</style></head><body>${records.map((d) => `<div class="receipt">${buildReceiptHtml(d, foundation)}</div>`).join("")}</body></html>`;
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

// Generate a multi-page PDF (one receipt per page). `onProgress` fires after
// each receipt so the caller can render a progress indicator.
export const savePdfReceipts = async (records, onProgress, foundation = null) => {
  const geo = pageGeometry(foundation);
  const pdf = new jsPDF({ unit: "pt", format: geo.paper, orientation: geo.orientation });
  for (let i = 0; i < records.length; i++) {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", top: "-9999px", left: "-9999px", width: `${geo.width}px`, margin: "0", border: geo.border, padding: "0", boxSizing: "border-box", background: "#fff", zIndex: "-1000" });
    el.innerHTML = buildReceiptHtml(records[i], foundation);
    document.body.appendChild(el);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: null });
    const imgData = canvas.toDataURL("image/png");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    document.body.removeChild(el);
    onProgress?.(i + 1, records.length);
  }
  const ts = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
  pdf.save(`report_${ts}.pdf`);
};

// Map donations to flat rows for react-csv. Centralised so the column set is
// consistent across any caller that exports donation data.
export const buildCsvRows = (records) =>
  records.map((d) => ({
    donorName: d.donor?.fullName ?? "",
    pan: d.donor?.pan ?? "",
    amount: formatAmount(d.amount),
    type: d.type ?? "",
    utrOrCheque: d.type === "CHEQUE" ? d.chequeNumber ?? "" : d.utr ?? "",
    bankName: d.bankName ?? "",
    donationDate: d.donationDate ?? "",
    transactionDate: d.transactionDate ?? "",
    status: d.donationReceived ?? "",
    printed: d.isPrinted ? "Yes" : "No",
  }));
