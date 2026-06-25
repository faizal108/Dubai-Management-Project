// src/features/donations/lib/receiptTemplate.js
// Shared receipt rendering + bulk export helpers. Consumed by the donation
// management page (and any future caller) so the HTML/PDF/CSV plumbing
// doesn't get duplicated across screens.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import logoUrl from "../../../assets/receipt-logo.png";
import YYIP_Stamp from "../../../assets/YYIP-STAMP.png";
import { convertNumberToWords } from "../../../lib/convertNumberToWords";

export const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export const formatDdMmYyyy = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
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

const numberToWordsUnderlined = (num) => {
  const safe = Number.isFinite(num) ? Math.floor(num) : 0;
  return `<span>${convertNumberToWords(safe)} only</span>`;
};

// Receipt body — inline styles so html2canvas snapshots survive detachment
// from the host stylesheet.
export const buildReceiptHtml = (d) => `
  <div style="display:flex; padding:16px;">
    <img src="${logoUrl}" alt="YIPP Logo" style="width:90px; margin-right:16px;" />
    <div>
      <div style="font-size:32px; line-height:1; color:#F37021; font-weight:bold;">
        YOUTH INDIA <span style="color:#009245;">PEACE PARTY</span>
      </div>
      <div style="font-size:12px; margin-top:8px; line-height:1.3;">
        Reg No. 56/111/LET/ECI/FUNC/PP/PPS-I/2018 • PAN No. AAABY1207D<br/>
        5th Floor, Awning No.24 Road Side Ajanta Center, Ashram Road,<br/>
        Ahmedabad-380009 • E-mail: yipp79@gmail.com
      </div>
    </div>
  </div>
  <hr style="border:none; border-top:1px solid #000; margin:0 16px;" />
  <div style="padding:16px; font-size:14px;">
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div style="display:flex;"><div><strong>Receipt No. Year ${new Date().getFullYear()} : </strong></div><div style="margin-left:5px;">${buildReceiptNo()}</div></div>
      <div style="display:flex;"><div><strong>Date : </strong></div><div style="border-bottom:1px solid #000; padding:2px 4px;">${formatDdMmYyyy(new Date().toISOString())}</div></div>
    </div>
    <div style="display:flex; margin-bottom:12px;">
      <div><strong>Received with thanks from Mr./Mrs./Ms.:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${d.donor?.fullName ?? ""}</div>
    </div>
    <div style="display:flex; margin-bottom:12px;">
      <div><strong>Address:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${d.donor?.address1 ?? ""}, ${d.donor?.city ?? ""}, ${d.donor?.state ?? ""}, ${d.donor?.country ?? ""}</div>
    </div>
    <div style="display:flex; margin-bottom:12px; align-items:center;">
      <div style="margin-right:8px;"><strong>PAN No.:</strong></div>
      <div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px; margin-right:16px;">${d.donor?.pan ?? ""}</div>
      <div style="margin-right:8px;"><strong>The sum of Rupees:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px;">${numberToWordsUnderlined(d.amount || 0)}</div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div><strong>Towards donation by Cash/Cheque/D.D. No.:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${(d.type === "CHEQUE" ? d.chequeNumber : d.utr) ?? ""}</div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div><strong>Drawn on:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin:0 8px;">${d.bankName ?? ""}</div>
      <div><strong>Branch:</strong></div>
      <div style="flex:1; border-bottom:1px solid #000; padding:2px 4px; margin-left:8px;">${d.ifsc ?? ""}</div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
      <div style="display:flex;"><div style="margin-right:8px;"><strong>Date : </strong></div><div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px;">${formatDdMmYyyy(d.donationDate)}</div></div>
      <div style="margin-top:10px;"><strong>for, YOUTH INDIA PEACE PARTY</strong></div>
    </div>
    <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center;">
        <div style="display:flex; align-items:center; border:2px solid #F37021; width:200px;">
          <div style="width:40px; height:40px; background-color:#F37021; color:white; font-size:24px; display:flex; align-items:center; justify-content:center;">&#8377;</div>
          <div style="width:100%; font-size:1.3rem; padding:2px; text-align:center;"><strong>${d.amount ?? ""}</strong> /-</div>
        </div>
        <div style="font-size:16px; text-align:center; font-weight:bold; line-height:115%; margin-left:5px;">
          This Donation is Eligible for Exemption<br/>Under Income Tax Act 1961 U/S 80GGC/80GGB
        </div>
      </div>
      <img src="${YYIP_Stamp}" height="130" width="130" alt="YIPP Stamp" style="position:absolute; bottom:-30px; right:30px;"/>
    </div>
  </div>
`;

// Print receipts via a hidden iframe so the host page doesn't lose state.
export const printReceipts = (records) =>
  new Promise((resolve) => {
    const fullHtml = `<html><head><title>Batch Donation Receipts</title><style>body{margin:0;font-family:Arial,sans-serif;}.receipt{width:1000px;margin:40px auto;border:8px solid #009245;padding:0;box-sizing:border-box;page-break-after:always;}</style></head><body>${records.map((d) => `<div class="receipt">${buildReceiptHtml(d)}</div>`).join("")}</body></html>`;
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
export const savePdfReceipts = async (records, onProgress) => {
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  for (let i = 0; i < records.length; i++) {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", top: "-9999px", left: "-9999px", width: "1000px", height: "500px", margin: "40px auto", border: "8px solid #009245", padding: "0", boxSizing: "border-box", background: "#fff", zIndex: "-1000" });
    el.innerHTML = buildReceiptHtml(records[i]);
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
