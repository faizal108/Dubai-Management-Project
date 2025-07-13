import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { CSVLink } from "react-csv";
import jsPDF from "jspdf";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { getAllDonations, updatePrintStatus } from "../apis/endpoints";
import { convertNumberToWords } from "../utils/convertNumberToWords";
import logoUrl from "../assets/receipt-logo.png";

// Debounce helper
function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const initialColumns = [
  { key: "donorName", label: "Donor Name" },
  { key: "pan", label: "PAN Number" },
  { key: "amount", label: "Amount" },
  { key: "donationDate", label: "Donation Date" },
  { key: "transactionDate", label: "Transaction Date" },
  { key: "donationReceived", label: "Status" },
  { key: "isPrinted", label: "Receipt Printed" },
];

const DonationReport = () => {
  // State
  const [donations, setDonations] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [printProgress, setPrintProgress] = useState({ done: 0, total: 0 });

  const csvLinkRef = useRef();

  const handleLoadData = async () => {
    setIsFetching(true);
    try {
      const resp = await getAllDonations();
      setDonations(resp.data || []);
      setFiltered(resp.data || []);
    } catch (err) {
      console.error("Error loading donations:", err);
      toast.error("Failed to load donation data.");
    } finally {
      setIsFetching(false);
    }
  };
  // Fetch from API once on mount
  useEffect(() => {
    handleLoadData();
  }, []);

  // Filtering logic
  const applyFilter = useCallback(() => {
    let out = donations.filter((d) => {
      const inRange =
        (!startDate || new Date(d.donationDate) >= new Date(startDate)) &&
        (!endDate || new Date(d.donationDate) <= new Date(endDate));
      const matchesSearch = Object.values({
        donorName: d.donor?.fullName || "",
        pan: d.donor?.pan || "",
        amount: d.amount?.toString() || "",
        donationDate: d.donationDate || "",
        transactionDate: d.transactionDate || "",
        donationReceived: d.donationReceived || "",
      })
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      return inRange && matchesSearch;
    });
    // sorting
    if (sortConfig.key) {
      out = [...out].sort((a, b) => {
        const aVal =
          a[sortConfig.key] || (a.donor ? a.donor[sortConfig.key] : "");
        const bVal =
          b[sortConfig.key] || (b.donor ? b.donor[sortConfig.key] : "");
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFiltered(out);
    setPage(1);
  }, [donations, search, startDate, endDate, sortConfig]);

  const debouncedFilter = useCallback(debounce(applyFilter, 300), [
    applyFilter,
  ]);
  useEffect(() => {
    debouncedFilter();
    return () => debouncedFilter.cancel();
  }, [search, startDate, endDate, sortConfig, debouncedFilter]);

  // Sorting handler
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Clear filters
  const clearAll = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setSortConfig({ key: null, direction: null });
    setFiltered(donations);
    setPage(1);
  };

  // Selection handlers
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };
  const toggleRow = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  // Export CSV handler
  const handleExport = () => {
    if (selectedIds.size === 0) {
      toast.info("Please select at least one record to export.");
      return;
    }
    csvLinkRef.current.link.click();
  };

  // Print handler with progress
  // const handlePrint = async () => {
  //   if (selectedIds.size === 0) {
  //     toast.info("Please select at least one record to print.");
  //     return;
  //   }
  //   const records = donations.filter((d) => selectedIds.has(d.id));
  //   setPrintProgress({ done: 0, total: records.length });

  //   for (let i = 0; i < records.length; i++) {
  //     const d = records[i];
  //     const doc = new jsPDF({ orientation: "landscape" });
  //     doc.setFontSize(14);
  //     doc.text(`Donor: ${d.donor?.fullName || "-"}`, 20, 30);
  //     doc.text(`PAN: ${d.donor?.pan}`, 60, 30);
  //     doc.text(`Amount: ₹${d.amount?.toFixed(2)}`, 60, 40);
  //     doc.text(`Donation Date: ${d.donationDate}`, 60, 50);
  //     doc.text(`Transaction Date: ${d.transactionDate || "-"}`, 60, 60);
  //     doc.text(`Status: ${d.donationReceived}`, 60, 70);
  //     doc.text(`Printed: ${d.isPrinted ? "Yes" : "No"}`, 60, 80);
  //     doc.autoPrint();

  //     // update printed status via API
  //     try {
  //       await updatePrintStatus(d.id);
  //     } catch (e) {
  //       console.error("Failed to update print status", e);
  //       toast.error("Failed to update print status");
  //     }

  //     setPrintProgress((prev) => ({ done: prev.done + 1, total: prev.total }));
  //     window.open(doc.output("bloburl"), "_blank");
  //   }
  //   toast.success("Print job completed");
  // };

  const handlePrint = async () => {
    if (selectedIds.size === 0) {
      toast.info("Please select at least one record to print.");
      return;
    }

    // Filter only RECEIVED donations
    const records = donations.filter(
      (d) => selectedIds.has(d.id) && d.donationReceived === "RECEIVED"
    );
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for printing.");
      return;
    }

    // Helper to underline number‑to‑words
    const numberToWordsUnderlined = (num) => {
      const words = convertNumberToWords(num) + " only";
      return `<span">${words}</span>`;
    };

    // Build per‑record HTML
    const buildReceiptHtml = (d) => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const receiptNo =
        pad(now.getFullYear() % 100) +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes());
      const donationDate = d.donationDate ? new Date(d.donationDate) : null;
      const donationDateStr = donationDate
        ? `${pad(donationDate.getDate())}/${pad(
            donationDate.getMonth() + 1
          )}/${donationDate.getFullYear()}`
        : "-";

      return `<div class="receipt">
          <div class="top-bar"></div>
          <div class="header">
            <img src="${logoUrl}" class="logo" alt="YIPP Logo" />
            <div>
              <div class="title">
                YOUTH INDIA <span class="peace">PEACE PARTY</span>
              </div>
              <div class="meta">
                Reg No. 56/111/LET/ECI/FUNC/PP/PPS‑I/2018 • PAN No. AAABY1207D<br/>
                5th Floor, Awning No.24 Road Side Ajanta Center, Ashram Road,<br/>
                Ahmedabad‑380009 • E‑mail: yipp79@gmail.com
              </div>
            </div>
          </div>
          <hr />
          <div class="content">
            <div class="row">
              <div class="row"><div><strong>Receipt No. Year ${new Date().getFullYear()} : </strong></div>
              <div style="width: fit-content;margin-left: 5px;">
                ${(() => {
                  const d = new Date();
                  const pad = (n) => String(n).padStart(2, "0");
                  return (
                    pad(d.getFullYear() % 100) +
                    pad(d.getMonth() + 1) +
                    pad(d.getDate()) +
                    pad(d.getHours()) +
                    pad(d.getMinutes())
                  );
                })()}
              </div>
              </div>
              <div class="row"><div><strong>Date : </strong></div>
              <div class="fill" style="width: fit-content;">
                ${(() => {
                  const d = new Date();
                  const day = String(d.getDate()).padStart(2, "0");
                  const month = String(d.getMonth() + 1).padStart(2, "0");
                  const year = d.getFullYear();
                  return `${day}/${month}/${year}`;
                })()}
              </div>
              </div>
            </div>

            <div class="row">
              <div><strong>Received with thanks from Mr./Mrs./Ms.:</strong></div>
              <div class="fill wide">${d.donor?.fullName || ""}</div>
            </div>
            
            <div class="row">
              <div><strong>Address:</strong></div>
              <div class="fill">${d.donor?.address1 || ""} ,${
        d.donor?.city || ""
      },${d.donor?.state || ""},${d.donor?.country || ""} </div>
            </div>

            <div class="row">
              <div class="label-min"><strong>PAN No.:</strong></div>
              <div class="fill-min">${d.donor?.pan || ""}</div>
              <div class="label-min"><strong>The sum of Rupees:</strong></div>
              <div class="fill-flex">${
                numberToWordsUnderlined(d.amount || 0) || ""
              }</div>
            </div>

            <div class="row">
              <div><strong>Towards donation by Cash/Cheque/D.D. No.:</strong></div>
              <div class="fill" style="width:200px;">${d.utr || ""}</div>
            </div>

            <div class="row">
              <div><strong>Drawn on:</strong></div>
              <div class="fill" style="width:200px;">${d.bankName || ""}</div>
              <div><strong>Branch:</strong></div>
              <div class="fill" style="width:200px;">${d.ifsc || ""}</div>
            </div>

            <div class="row">
              <div class="row">
                <div class="label-min"><Strong>Date : </Strong></div>
                <div class="fill-min" style="width: fit-content;">
                  ${(() => {
                    if (!d.donationDate) return "-";
                    const date = new Date(d.donationDate);
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()}
                </div>

              </div>

              <div class="row" style="margin-top: 10px;">
                <div class="label-min"><Strong>for, YOUTH INDIA PEACE PARTY</Strong></div>
              </div>
            </div>
            <div class="footer">
              <div class="amount-input" style="display: flex; align-items: center; border: 2px solid #F37021; width: 200px;">
                <div style="width: 40px; height: 40px; background-color: #F37021!important; color: white; font-size: 24px; display: flex; align-items: center; justify-content: center;">
                  &#8377;
                </div>
                <div style="width: 100%; font-size: 1.3rem; padding: 2px;text-align: center;"><Strong>${
                  d.amount || ""
                }</Strong> /-</div>
              </div>
              <div style="font-size:16px;text-align: center;font-weight: bold;line-height: 115%;margin-left: 5px;">
                This Donation is Eligible for Exemption<br/>
                Under Income Tax Act 1961 U/S 80GGC/80GGB
              </div>
            </div>
          </div>
          <div class="bottom-bar"></div>
        </div>`;
    };

    // Combine into one document with page breaks
    const fullHtml = `
      <html>
        <head>
          <title>Batch Donation Receipts</title>
          <style>
            body { margin:0; font-family: Arial, sans-serif; }
            .receipt { width:1000px; margin: 40px auto; border:8px solid #009245; padding:16px; box-sizing:border-box; page-break-after:always; }
            .top-bar { height:12px; background:#009245; }
          .bottom-bar { height:12px; background:#F37021; }
          .header { display:flex; padding:16px; }
          .logo { width:90px; margin-right:16px; }
          .title { flex:1; font-size:32px; line-height:1; color:#F37021; font-weight:bold; }
          .title .peace { color:#009245; }
          .meta { font-size:12px; margin-top:8px; line-height:1.3; }
          hr { border:none; border-top:1px solid #000; margin:0 16px; }
          .content { padding:16px; font-size:14px; }
          .row { display:flex; justify-content:space-between; margin-bottom:12px; }
          .label { width:180px; }
          .fill { flex:1; border-bottom:1px solid #000; padding:2px 4px; display:inline-block; }
          .wide { width:60%; }
          .amount-box { border:1px solid #F37021; display:inline-block; padding:8px; font-size:16px; margin-top:12px; }
          .sign-block { display:flex; justify-content:space-between; margin-top:24px; padding:0 16px; }
          .stamp { width:140px; }
          .footer {display: flex; align-items: center; }
          .label-min { min-width: fit-content; margin-right: 8px; }
          .fill-min { min-width: 150px; border-bottom: 1px solid #000; padding: 2px 4px; margin-right: 16px; }
          .fill-flex { flex: 1; border-bottom: 1px solid #000; padding: 2px 4px; }
          </style>
        </head>
        <body>
          ${records.map(buildReceiptHtml).join("")}
        </body>
      </html>
    `;

    // Print via hidden iframe
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        position: "absolute",
        width: 0,
        height: 0,
        border: "none",
      });
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();

      iframe.onload = async () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // cleanup, update status, refresh
        setTimeout(async () => {
          document.body.removeChild(iframe);
          await Promise.all(records.map((d) => updatePrintStatus(d.id)));
          await handleLoadData();
          toast.success("All selected receipts have been sent to print.");
          resolve();
        }, 500);
      };
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Progress Indicator */}
      {printProgress.total > 0 && printProgress.done < printProgress.total && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-full shadow-lg flex flex-col items-center">
          <svg className="animate-spin h-12 w-12 mb-2" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <circle
              className="opacity-75"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={`${
                (printProgress.done / printProgress.total) * 62.8
              } 62.8"`}
              fill="none"
            />
          </svg>
          <div>
            {printProgress.done}/{printProgress.total} Printed
          </div>
        </div>
      )}

      {/* Export & Print Controls */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleExport}
          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📥 Export CSV
        </button>
        <CSVLink
          data={donations.filter((d) => selectedIds.has(d.id))}
          filename="donation-report.csv"
          className="hidden"
          ref={csvLinkRef}
        />

        <button
          onClick={handlePrint}
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          🖨 Print Selected
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-md space-y-4">
        <h2 className="text-xl font-semibold text-gray-700">
          Donation Report List
        </h2>
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm text-gray-600">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border px-3 py-1 rounded"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border px-3 py-1 rounded"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm text-gray-600">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all columns"
              className="border px-3 py-1 rounded w-full"
            />
          </div>

          <button
            onClick={clearAll}
            className="mt-6 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
          >
            Clear All Filters
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto relative">
          {isFetching && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-2xl">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          )}
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.size === filtered.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                {initialColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2 cursor-pointer select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortConfig.key === col.key && (
                      <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={initialColumns.length + 1}
                    className="p-4 text-center text-gray-400"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                paged.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleRow(d.id)}
                      />
                    </td>
                    <td className="px-4 py-2">{d.donor?.fullName || "-"}</td>
                    <td className="px-4 py-2">{d.donor?.pan}</td>
                    <td className="px-4 py-2">₹{d.amount?.toFixed(2)}</td>
                    <td className="px-4 py-2">{d.donationDate}</td>
                    <td className="px-4 py-2">{d.transactionDate || "-"}</td>
                    <td className="px-4 py-2">{d.donationReceived}</td>
                    <td className="px-4 py-2">{d.isPrinted ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <div>
            Showing {filtered.length > 0 ? (page - 1) * pageSize + 1 : 0}-
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </div>
          <div className="flex items-center gap-2">
            <label>Rows per page:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border px-2 py-1 rounded"
            >
              {[20, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationReport;
