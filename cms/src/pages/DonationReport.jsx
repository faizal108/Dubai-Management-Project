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

    // Only print RECEIVED donations
    const records = donations.filter(
      (d) => selectedIds.has(d.id) && d.donationReceived === "RECEIVED"
    );
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for printing.");
      return;
    }

    setPrintProgress({ done: 0, total: records.length });

    for (let i = 0; i < records.length; i++) {
      const d = records[i];

      // 1) Build HTML snippet for this receipt
      const content = `
        <div style="font-family: sans-serif; margin: 40px;">
          <h2>Donation Receipt</h2>
          <p><strong>Donor:</strong> ${d.donor?.fullName || "-"}</p>
          <p><strong>PAN:</strong> ${d.donor?.pan || "-"}</p>
          <p><strong>Amount:</strong> ₹${d.amount?.toFixed(2)}</p>
          <p><strong>Donation Date:</strong> ${d.donationDate}</p>
          <p><strong>Transaction Date:</strong> ${d.transactionDate || "-"}</p>
          <p><strong>Status:</strong> ${d.donationReceived}</p>
        </div>
      `;

      // 2) Inject HTML into a hidden iframe
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              @media print {
                body { margin: 0; }
                h2 { margin-bottom: 16px; }
              }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      doc.close();

      // 3) Trigger native print dialog, then wait a moment
      await new Promise((resolve) => {
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(resolve, 500); // ensure dialog opens
        };
      });

      // 4) Cleanup iframe & update backend status
      document.body.removeChild(iframe);
      try {
        await updatePrintStatus(d.id);
        handleLoadData();    
      } catch (e) {
        console.error("Failed to update print status", e);
        toast.error("Failed to update print status for one record.");
      }

      setPrintProgress((prev) => ({
        done: prev.done + 1,
        total: prev.total,
      }));
    }

    toast.success("All selected receipts have been sent to print.");
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
