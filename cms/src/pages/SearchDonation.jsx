// Imports same as before
import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { getAllDonations } from "../apis/endpoints";

const columns = [
  { key: "donorName", label: "Donor Name" },
  { key: "pan", label: "PAN" },
  { key: "amount", label: "Amount" },
  { key: "type", label: "Type" },
  { key: "bankName", label: "Bank Name" },
  { key: "utr", label: "UTR" },
  { key: "ifsc", label: "IFSC" },
  { key: "donationDate", label: "Donation Date" },
  { key: "donationReceived", label: "Received Status" },
  { key: "transactionDate", label: "Transaction Date" },
];

const SearchDonation = () => {
  // Core state
  const [allDonations, setAllDonations] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // Table controls
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState({ key: null, asc: true });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Fetch with server-side pagination
  const fetchDonations = async () => {
    setIsFetching(true);
    try {
      // backend expects zero-based page index
      const response = await getAllDonations(page - 1, pageSize);
      console.log("Fetched donations:", response);
      setAllDonations(response.data || []);
      setTotalRecords(response.totalRecords || 0);
    } catch (err) {
      console.error("Error fetching donations:", err);
      toast.error("Unable to load donations.");
      setAllDonations([]);
      setTotalRecords(0);
    } finally {
      setIsFetching(false);
    }
  };

  // Trigger fetch on mount and whenever page or pageSize changes
  useEffect(() => {
    fetchDonations();
  }, [page, pageSize]);

  // Client-side search & filter over the current page
  const filteredData = useMemo(() => {
    return allDonations.filter((item) => {
      const itemFields = {
        donorName: item.donor?.fullName || "",
        pan: item.donor?.pan || "",
        amount: item.amount != null ? item.amount.toString() : "",
        type: item.type || "",
        bankName: item.bankName || "",
        utr: item.utr || "",
        ifsc: item.ifsc || "",
        donationDate: item.donationDate
          ? new Date(item.donationDate).toLocaleDateString()
          : "",
        donationReceived: item.donationReceived || "",
        transactionDate: item.transactionDate
          ? new Date(item.transactionDate).toLocaleDateString()
          : "",
      };

      const matchesSearch = search
        ? Object.values(itemFields).some((val) =>
            val.toLowerCase().includes(search.toLowerCase())
          )
        : true;

      const matchesFilters = Object.entries(filters).every(([key, val]) =>
        val ? itemFields[key]?.toLowerCase().includes(val.toLowerCase()) : true
      );

      return matchesSearch && matchesFilters;
    });
  }, [allDonations, search, filters]);

  // Client-side sort over filteredData
  const sortedData = useMemo(() => {
    if (!sort.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      let aVal, bVal;

      if (["donationDate", "transactionDate"].includes(sort.key)) {
        aVal = a[sort.key] ? new Date(a[sort.key]).getTime() : 0;
        bVal = b[sort.key] ? new Date(b[sort.key]).getTime() : 0;
      } else if (sort.key === "donorName") {
        aVal = a.donor?.fullName?.toLowerCase() || "";
        bVal = b.donor?.fullName?.toLowerCase() || "";
      } else if (sort.key === "pan") {
        aVal = a.donor?.pan?.toLowerCase() || "";
        bVal = b.donor?.pan?.toLowerCase() || "";
      } else {
        aVal = a[sort.key] ?? "";
        bVal = b[sort.key] ?? "";
      }

      if (aVal < bVal) return sort.asc ? -1 : 1;
      if (aVal > bVal) return sort.asc ? 1 : -1;
      return 0;
    });
  }, [filteredData, sort]);

  // Derive total pages from server total
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  return (
    <div className="space-y-8 relative">
      <div className="bg-white p-6 rounded-2xl shadow-md relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Search Donations
          </h2>
          <button
            onClick={fetchDonations}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded text-sm text-gray-700 hover:bg-gray-200"
            disabled={isFetching}
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Global Search */}
        <input
          type="text"
          placeholder="Search all fields"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full border px-4 py-2 rounded-lg mb-4"
          disabled={isFetching}
        />

        {/* Loading Overlay */}
        {isFetching && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-2xl">
            <span className="text-gray-500 text-sm">Loading...</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2">
                    <div
                      className="flex items-center gap-2 cursor-pointer select-none"
                      onClick={() =>
                        setSort((prev) =>
                          prev.key === col.key
                            ? { key: col.key, asc: !prev.asc }
                            : { key: col.key, asc: true }
                        )
                      }
                    >
                      {col.label}
                      {sort.key === col.key && (sort.asc ? "▲" : "▼")}
                    </div>
                    <input
                      type="text"
                      placeholder="Filter"
                      value={filters[col.key] || ""}
                      onChange={(e) => {
                        setFilters({ ...filters, [col.key]: e.target.value });
                        setPage(1);
                      }}
                      className="mt-1 border px-2 py-1 rounded w-full"
                      disabled={isFetching}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isFetching && sortedData.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="p-4 text-center text-gray-400"
                  >
                    No records found.
                  </td>
                </tr>
              )}
              {!isFetching &&
                sortedData.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{item.donor?.fullName || "-"}</td>
                    <td className="px-4 py-2">{item.donor?.pan || "-"}</td>
                    <td className="px-4 py-2">₹{item.amount?.toFixed(2)}</td>
                    <td className="px-4 py-2">{item.type}</td>
                    <td className="px-4 py-2">{item.bankName || "-"}</td>
                    <td className="px-4 py-2">{item.utr || "-"}</td>
                    <td className="px-4 py-2">{item.ifsc || "-"}</td>
                    <td className="px-4 py-2">
                      {item.donationDate
                        ? new Date(item.donationDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2">{item.donationReceived}</td>
                    <td className="px-4 py-2">
                      {item.transactionDate
                        ? new Date(item.transactionDate).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <div>
            Showing {totalRecords > 0 ? (page - 1) * pageSize + 1 : 0}-
            {Math.min(page * pageSize, totalRecords)} of {totalRecords} records
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="pageSize">Rows per page:</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
              disabled={page === 1 || isFetching}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded disabled:opacity-50"
              disabled={page === totalPages || isFetching}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchDonation;
