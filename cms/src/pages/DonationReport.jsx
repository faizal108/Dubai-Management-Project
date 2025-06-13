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
import { getAllDonations } from "../apis/endpoints";

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

const columns = [
  { key: "donorName", label: "Donor Name" },
  { key: "amount", label: "Amount" },
  { key: "donationDate", label: "Donation Date" },
  { key: "donationReceived", label: "Status" },
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

  const csvLinkRef = useRef();

  // Fetch from API once on mount
  useEffect(() => {
    const load = async () => {
      setIsFetching(true);
      try {
        const resp = await getAllDonations(); // expects { data: [...] }
        setDonations(resp.data || []);
        setFiltered(resp.data || []);
      } catch (err) {
        console.error("Error loading donations:", err);
        toast.error("Failed to load donation data.");
      } finally {
        setIsFetching(false);
      }
    };
    load();
  }, []);

  // Filtering logic
  const applyFilter = useCallback(() => {
    const out = donations.filter((d) => {
      const inRange =
        (!startDate || new Date(d.donationDate) >= new Date(startDate)) &&
        (!endDate || new Date(d.donationDate) <= new Date(endDate));
      const matchesSearch = Object.values({
        donorName: d.donor?.fullName || "",
        amount: d.amount?.toString() || "",
        donationDate: d.donationDate || "",
        donationReceived: d.donationReceived || "",
      })
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
      return inRange && matchesSearch;
    });
    setFiltered(out);
    setPage(1);
  }, [donations, search, startDate, endDate]);

  const debouncedFilter = useCallback(debounce(applyFilter, 300), [
    applyFilter,
  ]);

  useEffect(() => {
    debouncedFilter();
    return () => debouncedFilter.cancel();
  }, [search, startDate, endDate, debouncedFilter]);

  // Clear filters
  const clearAll = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
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

  // Print via jsPDF in landscape
  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast.info("Please select at least one record to print.");
      return;
    }
    // Build a single PDF with one page per selected record
    const doc = new jsPDF({ orientation: "landscape" });
    const selectedRecords = donations.filter((d) => selectedIds.has(d.id));
    selectedRecords.forEach((d, idx) => {
      if (idx > 0) {
        doc.addPage();
      }
      doc.setFontSize(14);
      doc.text(`Donor: ${d.donor?.fullName || "-"}`, 20, 30);
      doc.text(`Amount: ₹${d.amount?.toFixed(2)}`, 60, 40);
      doc.text(`Date: ${d.donationDate}`, 40, 50);
      doc.text(
        `Status: ${d.donationReceived ? "Received" : "Pending"}`,
        doc.internal.pageSize.getWidth() - 60,
        doc.internal.pageSize.getHeight() - 30
      );
    });
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <div className="space-y-6">
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
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
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
                    <td className="px-4 py-2">₹{d.amount?.toFixed(2)}</td>
                    <td className="px-4 py-2">{d.donationDate}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          d.donationReceived
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.donationReceived ? "Received" : "Pending"}
                      </span>
                    </td>
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
