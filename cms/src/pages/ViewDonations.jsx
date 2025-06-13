// src/pages/ViewDonations.jsx

import React, { useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { fetchDonationsByPan } from "../apis/endpoints";

const ViewDonations = ({ foundationId }) => {
  const [donor, setDonor] = useState(null);
  const [donations, setDonations] = useState([]);
  const [panSearch, setPanSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch donor + donations by PAN
  const handleSearch = async () => {
    const pan = panSearch.trim().toUpperCase();
    if (!pan) {
      toast.warn("Please enter a PAN to search.");
      return;
    }

    setSearchLoading(true);
    try {
      const data = await fetchDonationsByPan(pan);
      // Expecting data shape: { donor: { ... }, donations: [ ... ] }
      if (!data || !data.donor) {
        toast.info(`No donor found for PAN: ${pan}`);
        setDonor(null);
        setDonations([]);
      } else {
        setDonor(data.donor);
        setDonations(data.donations || []);
        if (!data.donations || data.donations.length === 0) {
          toast.info(`No donations found for PAN: ${pan}`);
        }
      }
      setHasSearched(true);
    } catch (err) {
      console.error("Search by PAN error:", err);
      toast.error("Unable to fetch donations by PAN.");
      setDonor(null);
      setDonations([]);
      setHasSearched(true);
    } finally {
      setSearchLoading(false);
    }
  };

  // Clear search and reset to initial state
  const handleRefresh = () => {
    setPanSearch("");
    setDonor(null);
    setDonations([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search by PAN"
              value={panSearch}
              onChange={(e) => setPanSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={searchLoading}
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className={`flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-opacity ${
                searchLoading ? "opacity-50" : "opacity-100"
              }`}
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              <span>{searchLoading ? "Searching..." : "Search"}</span>
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={searchLoading}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
          >
            <ArrowPathIcon className="h-5 w-5" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>

        {hasSearched && donor && (
          <div className="bg-green-50 p-4 rounded-lg mb-6">
            <p className="text-gray-700 font-bold">
              <span className="font-medium">Donor Name:</span> {donor.fullName}
            </p>
            <p className="text-gray-700 font-bold">
              <span className="font-medium">PAN:</span> {donor.pan}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Bank Name</th>
                <th className="px-4 py-2">UTR / Cheque No / Trans Ref</th>
                <th className="px-4 py-2">IFSC</th>
                <th className="px-4 py-2">Donation Date</th>
                <th className="px-4 py-2">Received Status</th>
                <th className="px-4 py-2">Transaction Date</th>
              </tr>
            </thead>
            <tbody>
              {!hasSearched ? (
                <tr>
                  <td colSpan="8" className="p-4" />
                </tr>
              ) : donations.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-4 py-4 text-center text-gray-400"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                donations.map((d) => (
                  <tr key={d.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">₹{d.amount.toFixed(2)}</td>
                    <td className="px-4 py-2">{d.type}</td>
                    <td className="px-4 py-2">{d.bankName}</td>
                    <td className="px-4 py-2">{d.utr}</td>
                    <td className="px-4 py-2">{d.ifsc}</td>
                    <td className="px-4 py-2">
                      {new Date(d.donationDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{d.donationReceived}</td>
                    <td className="px-4 py-2">
                      {d.transactionDate
                        ? new Date(d.transactionDate).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ViewDonations;
