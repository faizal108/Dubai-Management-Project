// src/features/donations/pages/DonorHistory.jsx
// PAN-based donor lookup with full donation history. The PAN input is the
// single entry point — on submit we resolve the donor (donors?q=PAN with
// client-side exact match) and then page through that donor's donations via
// the standard /donations list scoped by donorId. Receipt PDF generation
// reuses the same html2canvas + jsPDF flow as DonationReport but runs one
// record at a time from the row action menu (no bulk select here).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PrinterIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import { fetchDonorByPan, getDonor } from "../../donors/api";
import { listDonations, markDonationPrinted } from "../api";
import { convertNumberToWords } from "../../../lib/convertNumberToWords";
import logoUrl from "../../../assets/receipt-logo.png";
import YYIP_Stamp from "../../../assets/YYIP-STAMP.png";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Badge,
  PageHeader,
  EmptyState,
  Spinner,
  FormField,
} from "../../../components/ui";
import { PERMISSIONS } from "../../../constants/permissions";
import { usePermissions } from "../../../hooks/usePermissions";

const PAGE_SIZE = 100; // donor histories are small; one page is usually enough

const formatAmount = (a) => {
  const n = typeof a === "string" ? parseFloat(a) : a;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const formatDdMmYyyy = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

const buildReceiptNo = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    pad(d.getFullYear() % 100) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
};

const numberToWordsUnderlined = (num) => {
  const safe = Number.isFinite(num) ? Math.floor(num) : 0;
  return `<span>${convertNumberToWords(safe)} only</span>`;
};

// Mirror of the receipt template used in DonationReport. Kept inline so this
// page is self-contained — extracting into a shared lib would mean touching
// DonationReport, which is outside this change's scope.
const buildReceiptHtml = (d) => `
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
      <div style="display:flex;">
        <div><strong>Receipt No. Year ${new Date().getFullYear()} : </strong></div>
        <div style="margin-left:5px;">${buildReceiptNo()}</div>
      </div>
      <div style="display:flex;">
        <div><strong>Date : </strong></div>
        <div style="border-bottom:1px solid #000; padding:2px 4px;">${formatDdMmYyyy(new Date().toISOString())}</div>
      </div>
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
      <div style="display:flex;">
        <div style="margin-right:8px;"><strong>Date : </strong></div>
        <div style="min-width:150px; border-bottom:1px solid #000; padding:2px 4px;">${formatDdMmYyyy(d.donationDate)}</div>
      </div>
      <div style="margin-top:10px;"><strong>for, YOUTH INDIA PEACE PARTY</strong></div>
    </div>
    <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center;">
        <div style="display:flex; align-items:center; border:2px solid #F37021; width:200px;">
          <div style="width:40px; height:40px; background-color:#F37021; color:white; font-size:24px; display:flex; align-items:center; justify-content:center;">&#8377;</div>
          <div style="width:100%; font-size:1.3rem; padding:2px; text-align:center;"><strong>${d.amount ?? ""}</strong> /-</div>
        </div>
        <div style="font-size:16px; text-align:center; font-weight:bold; line-height:115%; margin-left:5px;">
          This Donation is Eligible for Exemption<br/>
          Under Income Tax Act 1961 U/S 80GGC/80GGB
        </div>
      </div>
      <img src="${YYIP_Stamp}" height="130" width="130" alt="YIPP Stamp" style="position:absolute; bottom:-30px; right:30px;"/>
    </div>
  </div>
`;

// Statement-style HTML for the full donor history report. Rendered offscreen
// and captured by html2canvas, then paginated into A4 portrait pages by the
// download handler. Inline styles only — html2canvas does not pick up our
// Tailwind classes from the live DOM tree.
const buildHistoryHtml = (donor, donations, summary) => {
  const dates = donations
    .map((d) => d.donationDate)
    .filter(Boolean)
    .sort();
  const fromDate = dates[0] ? formatDdMmYyyy(dates[0]) : "-";
  const toDate = dates[dates.length - 1] ? formatDdMmYyyy(dates[dates.length - 1]) : "-";
  const generatedOn = formatDdMmYyyy(new Date().toISOString());

  const addressLine =
    [donor?.address1, donor?.address2, donor?.city, donor?.state, donor?.country, donor?.pincode]
      .filter(Boolean)
      .join(", ") || "-";

  const rows = donations
    .map((d, idx) => {
      const ref = d.type === "CHEQUE" ? d.chequeNumber || "-" : d.utr || "-";
      const statusColor = d.donationReceived === "RECEIVED" ? "#009245" : "#B45309";
      return `
        <tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:8px 10px; font-size:11px;">${idx + 1}</td>
          <td style="padding:8px 10px; font-size:11px; white-space:nowrap;">${formatDdMmYyyy(d.donationDate)}</td>
          <td style="padding:8px 10px; font-size:11px;">${d.type || "-"}</td>
          <td style="padding:8px 10px; font-size:11px; font-family:monospace;">${ref}</td>
          <td style="padding:8px 10px; font-size:11px;">${d.bankName || "-"}</td>
          <td style="padding:8px 10px; font-size:11px; color:${statusColor}; font-weight:600;">
            ${d.donationReceived === "RECEIVED" ? "Received" : "Pending"}
          </td>
          <td style="padding:8px 10px; font-size:11px; text-align:right; font-weight:600;">
            ₹ ${formatAmount(d.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="padding:24px 28px; font-family: Arial, sans-serif; color:#111827;">
      <div style="display:flex; align-items:center; gap:14px; padding-bottom:14px; border-bottom:2px solid #F37021;">
        <img src="${logoUrl}" alt="YIPP Logo" style="width:70px;" />
        <div>
          <div style="font-size:22px; line-height:1; color:#F37021; font-weight:bold;">
            YOUTH INDIA <span style="color:#009245;">PEACE PARTY</span>
          </div>
          <div style="font-size:10px; margin-top:6px; line-height:1.4; color:#374151;">
            Reg No. 56/111/LET/ECI/FUNC/PP/PPS-I/2018 • PAN No. AAABY1207D<br/>
            5th Floor, Awning No.24 Road Side Ajanta Center, Ashram Road,
            Ahmedabad-380009 • E-mail: yipp79@gmail.com
          </div>
        </div>
      </div>

      <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-size:16px; font-weight:bold; color:#111827;">Donor Statement</div>
          <div style="font-size:11px; color:#6B7280; margin-top:2px;">
            Period: ${fromDate} &mdash; ${toDate}
          </div>
        </div>
        <div style="font-size:11px; color:#6B7280; text-align:right;">
          Generated on: ${generatedOn}<br/>
          Statement Ref: DS-${buildReceiptNo()}
        </div>
      </div>

      <div style="margin-top:14px; border:1px solid #E5E7EB; border-radius:6px; padding:12px 14px; background:#F9FAFB;">
        <div style="font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
          Donor Details
        </div>
        <div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; font-size:12px;">
          <div><strong>Name:</strong> ${donor?.fullName || "-"}</div>
          <div><strong>PAN:</strong> <span style="font-family:monospace;">${donor?.pan || "-"}</span></div>
          <div><strong>Phone:</strong> ${donor?.phone || "-"}</div>
          <div><strong>Email:</strong> ${donor?.email || "-"}</div>
          <div style="grid-column:1 / span 2;"><strong>Address:</strong> ${addressLine}</div>
        </div>
      </div>

      <div style="margin-top:14px; display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
        <div style="border:1px solid #E5E7EB; border-radius:6px; padding:12px;">
          <div style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
            Total Donated
          </div>
          <div style="font-size:18px; font-weight:700; margin-top:4px; color:#111827;">₹ ${formatAmount(summary.total)}</div>
          <div style="font-size:10px; color:#6B7280; margin-top:2px;">${donations.length} donation(s)</div>
        </div>
        <div style="border:1px solid #E5E7EB; border-radius:6px; padding:12px;">
          <div style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
            Received
          </div>
          <div style="font-size:18px; font-weight:700; margin-top:4px; color:#009245;">₹ ${formatAmount(summary.received)}</div>
          <div style="font-size:10px; color:#6B7280; margin-top:2px;">${summary.countReceived} record(s)</div>
        </div>
        <div style="border:1px solid #E5E7EB; border-radius:6px; padding:12px;">
          <div style="font-size:10px; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
            Pending
          </div>
          <div style="font-size:18px; font-weight:700; margin-top:4px; color:#B45309;">₹ ${formatAmount(summary.pending)}</div>
          <div style="font-size:10px; color:#6B7280; margin-top:2px;">${summary.countPending} record(s)</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-size:12px; font-weight:600; color:#111827; margin-bottom:6px;">Transactions</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #E5E7EB;">
          <thead>
            <tr style="background:#F37021; color:#FFFFFF;">
              <th style="padding:8px 10px; font-size:11px; text-align:left;">#</th>
              <th style="padding:8px 10px; font-size:11px; text-align:left;">Date</th>
              <th style="padding:8px 10px; font-size:11px; text-align:left;">Type</th>
              <th style="padding:8px 10px; font-size:11px; text-align:left;">UTR / Cheque</th>
              <th style="padding:8px 10px; font-size:11px; text-align:left;">Bank</th>
              <th style="padding:8px 10px; font-size:11px; text-align:left;">Status</th>
              <th style="padding:8px 10px; font-size:11px; text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="7" style="padding:14px; text-align:center; font-size:11px; color:#6B7280;">No transactions.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background:#F3F4F6;">
              <td colspan="6" style="padding:8px 10px; font-size:11px; font-weight:700; text-align:right;">Grand Total</td>
              <td style="padding:8px 10px; font-size:12px; font-weight:700; text-align:right;">₹ ${formatAmount(summary.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="margin-top:18px; font-size:10px; color:#6B7280; line-height:1.5; border-top:1px solid #E5E7EB; padding-top:10px;">
        This is a computer-generated statement and does not require a signature.
        Donations marked as <strong style="color:#009245;">Received</strong> are eligible for exemption under
        Section 80GGC/80GGB of the Income Tax Act, 1961. Pending donations will be eligible upon realization.
      </div>
    </div>
  `;
};

const statusBadge = (s) =>
  s === "RECEIVED" ? (
    <Badge variant="success" size="sm">Received</Badge>
  ) : (
    <Badge variant="warning" size="sm">Pending</Badge>
  );

export default function DonorHistory() {
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pan, setPan] = useState("");
  const [donor, setDonor] = useState(null);
  const [donations, setDonations] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });
  const [isExportingHistory, setIsExportingHistory] = useState(false);
  const inputRef = useRef(null);

  // Aggregates derived from the loaded donations — re-computed only when
  // the list changes, so toggling per-row state (none today) wouldn't cost
  // a full recount.
  const summary = useMemo(() => {
    const acc = { total: 0, received: 0, pending: 0, countReceived: 0, countPending: 0 };
    for (const d of donations) {
      const amt = parseFloat(d.amount) || 0;
      acc.total += amt;
      if (d.donationReceived === "RECEIVED") {
        acc.received += amt;
        acc.countReceived += 1;
      } else {
        acc.pending += amt;
        acc.countPending += 1;
      }
    }
    return acc;
  }, [donations]);

  const handleSearch = async (eOrPan) => {
    // Accepts either a form event (manual submit) or an explicit PAN string
    // (auto-trigger from ?pan= deep link). The branch keeps the form's submit
    // path identical while letting the URL effect skip the input-state round-trip.
    let overridePan;
    if (typeof eOrPan === "string") {
      overridePan = eOrPan;
    } else {
      eOrPan?.preventDefault?.();
    }
    const normalized = (overridePan ?? pan).trim().toUpperCase();
    if (!normalized) {
      toast.info("Enter a PAN to search.");
      inputRef.current?.focus();
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setDonor(null);
    setDonations([]);
    try {
      const found = await fetchDonorByPan(normalized);
      if (!found) {
        toast.error("No donor found for that PAN.");
        return;
      }
      setDonor(found);
      // Mirror the donor's opaque ID into the URL — never the PAN — so
      // refresh / bookmark / back-button restore the same view without
      // leaking PII in browser history.
      setSearchParams({ donorId: found.id }, { replace: true });
      const res = await listDonations({ donorId: found.id, pageSize: PAGE_SIZE });
      setDonations(res?.items ?? []);
    } catch (err) {
      console.error("Donor history fetch failed:", err);
      toast.error("Failed to load donor history.");
    } finally {
      setIsSearching(false);
    }
  };

  // Deep-link / refresh entry point: when the URL carries ?donorId=<id>,
  // fetch that donor directly (no PAN round-trip) and load history. Runs
  // once on mount; deps stay empty because handleSearch writes via `replace`
  // and we don't want that to re-fire this effect.
  useEffect(() => {
    const urlDonorId = searchParams.get("donorId");
    if (!urlDonorId) return;
    let cancelled = false;
    (async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const found = await getDonor(urlDonorId);
        if (cancelled) return;
        if (!found) {
          toast.error("Donor not found.");
          return;
        }
        setDonor(found);
        setPan(found.pan || "");
        const res = await listDonations({ donorId: found.id, pageSize: PAGE_SIZE });
        if (cancelled) return;
        setDonations(res?.items ?? []);
      } catch (err) {
        if (cancelled) return;
        console.error("Donor history fetch failed:", err);
        toast.error("Failed to load donor history.");
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setPan("");
    setDonor(null);
    setDonations([]);
    setHasSearched(false);
    // Drop the URL param so a refresh after Reset lands on the empty page.
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  };

  // Per-row receipt PDF — same html2canvas + jsPDF flow as DonationReport's
  // batch path, just for a single record. We attach the donor relation to
  // the donation if the row didn't already include it (it should).
  const handleDownloadPdf = async (d) => {
    if (d.donationReceived !== "RECEIVED") {
      toast.error("Only RECEIVED donations can be downloaded as receipts.");
      return;
    }
    const record = d.donor ? d : { ...d, donor };
    setPdfProgress({ done: 0, total: 1 });
    try {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        top: "-9999px",
        left: "-9999px",
        width: "1000px",
        height: "500px",
        margin: "40px auto",
        border: "8px solid #009245",
        padding: "0",
        boxSizing: "border-box",
        background: "#fff",
        zIndex: "-1000",
      });
      el.innerHTML = buildReceiptHtml(record);
      document.body.appendChild(el);

      const canvas = await html2canvas(el, { scale: 2, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      document.body.removeChild(el);

      const stamp = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
      pdf.save(`receipt_${record.donor?.pan ?? "donor"}_${stamp}.pdf`);
      setPdfProgress({ done: 1, total: 1 });

      if (can(PERMISSIONS.DONATION_MARK_PRINTED) && !d.isPrinted) {
        try {
          await markDonationPrinted(d.id);
          setDonations((prev) =>
            prev.map((row) => (row.id === d.id ? { ...row, isPrinted: true } : row))
          );
        } catch (err) {
          console.error(`Mark printed failed for ${d.id}:`, err);
        }
      }
      toast.success("Receipt downloaded.");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Could not generate the receipt PDF.");
    } finally {
      setPdfProgress({ done: 0, total: 0 });
    }
  };

  const handlePrint = async (d) => {
    if (d.donationReceived !== "RECEIVED") {
      toast.error("Only RECEIVED donations can be printed.");
      return;
    }
    const record = d.donor ? d : { ...d, donor };
    const fullHtml = `
      <html>
        <head>
          <title>Donation Receipt</title>
          <style>
            body { margin:0; font-family: Arial, sans-serif; }
            .receipt { width:1000px; margin:40px auto; border:8px solid #009245; padding:0; box-sizing:border-box; }
          </style>
        </head>
        <body>
          <div class="receipt">${buildReceiptHtml(record)}</div>
        </body>
      </html>
    `;
    await new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, { position: "absolute", width: 0, height: 0, border: "none" });
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();
      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, 500);
      };
    });
    if (can(PERMISSIONS.DONATION_MARK_PRINTED) && !d.isPrinted) {
      try {
        await markDonationPrinted(d.id);
        setDonations((prev) =>
          prev.map((row) => (row.id === d.id ? { ...row, isPrinted: true } : row))
        );
      } catch (err) {
        console.error(`Mark printed failed for ${d.id}:`, err);
      }
    }
  };

  // Full donor history as an A4-portrait statement PDF. The statement DOM is
  // rendered offscreen at a fixed CSS width (760px), captured by html2canvas
  // at 2x scale, then sliced into page-sized chunks so long histories paginate
  // cleanly instead of getting clipped at the bottom of page 1.
  const handleDownloadHistoryPdf = async () => {
    if (!donor) {
      toast.info("Search for a donor first.");
      return;
    }
    if (donations.length === 0) {
      toast.info("This donor has no donations to export.");
      return;
    }
    setIsExportingHistory(true);
    try {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        top: "-9999px",
        left: "-9999px",
        width: "760px",
        background: "#fff",
        boxSizing: "border-box",
        zIndex: "-1000",
      });
      el.innerHTML = buildHistoryHtml(donor, donations, summary);
      document.body.appendChild(el);

      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      document.body.removeChild(el);

      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const renderW = pageW - margin * 2;
      const renderH = (canvas.height * renderW) / canvas.width;

      if (renderH <= pageH - margin * 2) {
        // Single-page fit — straight blit.
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, renderW, renderH);
      } else {
        // Paginate: each page shows a vertical slice of the source canvas.
        const pxPerPt = canvas.width / renderW;
        const sliceHeightPx = Math.floor((pageH - margin * 2) * pxPerPt);
        let consumedPx = 0;
        let pageIndex = 0;
        while (consumedPx < canvas.height) {
          const remainingPx = canvas.height - consumedPx;
          const thisSlicePx = Math.min(sliceHeightPx, remainingPx);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = thisSlicePx;
          const ctx = sliceCanvas.getContext("2d");
          ctx.drawImage(
            canvas,
            0, consumedPx, canvas.width, thisSlicePx,
            0, 0, canvas.width, thisSlicePx
          );
          const sliceRenderH = (thisSlicePx * renderW) / canvas.width;
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(
            sliceCanvas.toDataURL("image/png"),
            "PNG",
            margin,
            margin,
            renderW,
            sliceRenderH
          );
          consumedPx += thisSlicePx;
          pageIndex += 1;
        }
      }

      const stamp = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
      pdf.save(`donor_statement_${donor.pan || donor.id}_${stamp}.pdf`);
      toast.success("Donor statement downloaded.");
    } catch (err) {
      console.error("History PDF generation failed:", err);
      toast.error("Could not generate the donor statement PDF.");
    } finally {
      setIsExportingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      {((pdfProgress.total > 0 && pdfProgress.done < pdfProgress.total) || isExportingHistory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Card className="w-80">
            <CardBody className="flex flex-col items-center gap-3 py-6">
              <Spinner size="lg" />
              <p className="text-sm text-muted-foreground">
                {isExportingHistory ? "Generating donor statement…" : "Generating receipt…"}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <PageHeader
        title="Donor History"
        subtitle="Look up a donor by PAN to view their complete donation history, download individual receipts, or export the full statement."
      />

      <Card>
        <CardHeader>
          <CardTitle>PAN Lookup</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <FormField label="PAN Number" className="flex-1" hint="Exact 10-character PAN (case-insensitive).">
              <Input
                ref={inputRef}
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                autoFocus
              />
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Spinner size="sm" />
                    Searching…
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
              {hasSearched && (
                <Button type="button" variant="ghost" onClick={handleReset}>
                  <ArrowPathIcon className="h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      {donor && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Donor Profile</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{donor.fullName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">PAN</dt>
                  <dd className="mt-1 text-sm font-mono text-foreground">{donor.pan || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</dt>
                  <dd className="mt-1 text-sm text-foreground">{donor.phone || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
                  <dd className="mt-1 text-sm text-foreground">{donor.email || "-"}</dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {[donor.address1, donor.address2, donor.city, donor.state, donor.country, donor.pincode]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Donated</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">₹ {formatAmount(summary.total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{donations.length} donation(s)</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Received</p>
                <p className="mt-1 text-2xl font-semibold text-success">₹ {formatAmount(summary.received)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{summary.countReceived} record(s)</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="mt-1 text-2xl font-semibold text-warning">₹ {formatAmount(summary.pending)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{summary.countPending} record(s)</p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Donation History</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadHistoryPdf}
                disabled={isExportingHistory || donations.length === 0}
                title={
                  donations.length === 0
                    ? "No donations to export"
                    : "Download the full donor statement as a PDF"
                }
              >
                {isExportingHistory ? (
                  <>
                    <Spinner size="sm" />
                    Generating…
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="h-4 w-4" />
                    Download Full History (PDF)
                  </>
                )}
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {donations.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No donations yet"
                    description="This donor has no recorded donations."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">UTR / Cheque</th>
                        <th className="px-4 py-3">Bank</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Printed</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {donations.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/20">
                          <td className="whitespace-nowrap px-4 py-3 text-foreground">
                            {formatDdMmYyyy(d.donationDate)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-foreground">
                            ₹ {formatAmount(d.amount)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-foreground">{d.type}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                            {d.type === "CHEQUE" ? d.chequeNumber || "-" : d.utr || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {d.bankName || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">{statusBadge(d.donationReceived)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {d.isPrinted ? (
                              <Badge variant="primary" size="sm">Yes</Badge>
                            ) : (
                              <Badge variant="default" size="sm">No</Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={d.donationReceived !== "RECEIVED"}
                                onClick={() => handleDownloadPdf(d)}
                                title={
                                  d.donationReceived === "RECEIVED"
                                    ? "Download receipt PDF"
                                    : "Only RECEIVED donations can be downloaded"
                                }
                              >
                                <DocumentArrowDownIcon className="h-4 w-4" />
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={d.donationReceived !== "RECEIVED"}
                                onClick={() => handlePrint(d)}
                                title={
                                  d.donationReceived === "RECEIVED"
                                    ? "Print receipt"
                                    : "Only RECEIVED donations can be printed"
                                }
                              >
                                <PrinterIcon className="h-4 w-4" />
                                Print
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {hasSearched && !donor && !isSearching && (
        <Card>
          <CardBody>
            <EmptyState
              title="No donor found"
              description="No donor matches that PAN in your foundation. Check the PAN and try again."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
