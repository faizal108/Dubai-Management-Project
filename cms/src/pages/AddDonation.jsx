// src/pages/AddDonation.jsx

import React, { useState, useEffect } from "react";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import {
  addDonation,
  deleteDonation,
  fetchDonorByPan,
  getAllDonations,
  getDonationById,
  updateDonation,
} from "../apis/endpoints";

const donationTypes = ["CASH", "CHEQUE", "ONLINE"];

const initialForm = {
  pan: "",
  donorId: "",
  donorName: "",
  amount: "",
  type: "CASH",
  bankName: "",
  utr: "",
  ifsc: "",
  donationDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  transactionDate: "",
  donationReceived: "PENDING",
};

const AddDonation = ({ foundationId }) => {
  const [form, setForm] = useState(initialForm);
  const [donations, setDonations] = useState([]); // must be an array
  const [editId, setEditId] = useState(null);
  const [loadingDonorLookup, setLoadingDonorLookup] = useState(false);
  const [panLookupStatus, setPanLookupStatus] = useState({
    status: null, // "success" | "error" | null
    message: "",
  });
  const [fetchingDonations, setFetchingDonations] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // ─────────────── FETCH DONATIONS (ARRAY) ───────────────
  const fetchDonations = async () => {
    setFetchingDonations(true);
    try {
      const response = await getAllDonations();
      // response.data is { totalRecords, pageCount, currentPage, pageSize, data: [ ... ] }
      const arr = response?.data || [];
      setDonations(arr);
    } catch (err) {
      console.error("Fetch donations error:", err);
      toast.error("Unable to load donations.");
      setDonations([]);
    } finally {
      setFetchingDonations(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  // ─────────────── PAN LOOKUP ───────────────
  const handlePanBlur = async () => {
    const pan = form.pan.trim();
    if (!pan) {
      setForm((f) => ({ ...f, donorId: "", donorName: "" }));
      setPanLookupStatus({ status: null, message: "" });
      return;
    }

    setLoadingDonorLookup(true);
    try {
      const response = await fetchDonorByPan(pan);
      if (!response?.exists) {
        setForm((f) => ({ ...f, donorId: "", donorName: "" }));
        setPanLookupStatus({
          status: "error",
          message: "✖ Donor not found for this PAN.",
        });
      } else {
        setForm((f) => ({
          ...f,
          donorId: response.donor.id,
          donorName: response.donor.fullName,
        }));
        setPanLookupStatus({
          status: "success",
          message: `✔ Donor found: ${response.donor.fullName}`,
        });
      }
    } catch (err) {
      console.error("PAN lookup error:", err);
      toast.error("Unable to fetch donor by PAN.");
      setPanLookupStatus({ status: null, message: "" });
      setForm((f) => ({ ...f, donorId: "", donorName: "" }));
    } finally {
      setLoadingDonorLookup(false);
    }
  };

  // ─────────────── CLEAR FORM / CANCEL EDIT ───────────────
  const clearForm = () => {
    setForm(initialForm);
    setEditId(null);
    setPanLookupStatus({ status: null, message: "" });
  };

  // ─────────────── GENERIC FORM HANDLING ───────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "pan") {
      setPanLookupStatus({ status: null, message: "" });
      setForm((f) => ({
        ...f,
        pan: value.toUpperCase(),
        donorId: "",
        donorName: "",
      }));
      return;
    }
    if (name === "donationReceived" && value === "PENDING") {
      setForm((f) => ({ ...f, [name]: value, transactionDate: "" }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ─────────────── SUBMIT / ADD / UPDATE ───────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.donorId) {
      toast.warn("Please enter a valid PAN (donor lookup required).");
      return;
    }
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.warn("Please enter a valid amount.");
      return;
    }
    if (form.type !== "CASH") {
      if (!form.bankName.trim()) {
        toast.warn("Bank Name is required.");
        return;
      }
      if (!form.utr.trim()) {
        toast.warn("UTR/Cheque No/Trans Ref is required.");
        return;
      }
      if (!form.ifsc.trim()) {
        toast.warn("IFSC Code is required.");
        return;
      }
    }
    if (form.donationReceived === "RECEIVED" && !form.transactionDate) {
      toast.warn("Transaction Date is required when donation is Received.");
      return;
    }
    if (!form.donationDate) {
      toast.warn("Donation Date is required.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        donorId: form.donorId,
        amount: parseFloat(form.amount),
        type: form.type,
        bankName: form.type === "CASH" ? null : form.bankName.trim(),
        utr: form.type === "CASH" ? null : form.utr.trim(),
        ifsc: form.type === "CASH" ? null : form.ifsc.trim(),
        donationDate: new Date(form.donationDate).toISOString(),
        transactionDate: form.transactionDate
          ? new Date(form.transactionDate).toISOString()
          : null,
        donationReceived: form.donationReceived,
      };

      if (editId) {
        await updateDonation(editId, payload);
        toast.success("Donation updated.");
      } else {
        await addDonation(payload);
        toast.success("Donation added.");
      }

      clearForm();
      await fetchDonations();
    } catch (err) {
      console.error("Submit donation error:", err);
      toast.error("Unable to save donation. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  // ─────────────── EDIT MODE: FETCH LATEST RECORD ───────────────
  const handleEdit = async (donationId) => {
    setFormLoading(true);
    try {
      const response = await getDonationById(donationId);

      setForm({
        pan: response.donor.pan,
        donorId: response.donor.id,
        donorName: response.donor.fullName,
        amount: response.amount.toString(),
        type: response.type,
        bankName: response.bankName || "",
        utr: response.utr || "",
        ifsc: response.ifsc || "",
        donationDate: response.donationDate
          ? response.donationDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        transactionDate: response.transactionDate
          ? response.transactionDate.slice(0, 10)
          : "",
        donationReceived: response.donationReceived,
      });
      setEditId(response.id);

      setPanLookupStatus({
        status: "success",
        message: `✔ Donor found: ${response.donor.fullName}`,
      });
    } catch (err) {
      console.error("Fetch donation by ID error:", err);
      toast.error("Unable to load donation for editing.");
    } finally {
      setFormLoading(false);
    }
  };

  // ─────────────── DELETE ───────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this donation?")) {
      return;
    }
    try {
      await deleteDonation(id);
      toast.info("Donation deleted!");
      setDonations((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Delete donation error:", err);
      toast.error("Could not delete donation. Please try again.");
    }
  };

  // ─────────────── RENDER ───────────────
  return (
    <div className="space-y-8">
      {/* ── ADD / UPDATE FORM ── */}
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center justify-between">
          {editId ? "Update Donation" : "Add Donation"}
          {editId && (
            <button
              onClick={clearForm}
              disabled={formLoading}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Cancel Edit
            </button>
          )}
          {!editId && (
            <button
              onClick={clearForm}
              disabled={formLoading}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Form
            </button>
          )}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* ── PAN Number Field ── */}
          <div className="md:col-span-2 relative">
            <label className="block text-sm font-medium mb-1">PAN Number</label>
            <input
              type="text"
              name="pan"
              placeholder="Enter PAN"
              value={form.pan}
              onChange={handleChange}
              onBlur={handlePanBlur}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={formLoading}
              required
            />

            {/* Inline PAN Lookup Feedback */}
            {panLookupStatus.status === "success" && (
              <p className="text-green-600 text-sm mt-1">
                {panLookupStatus.message}
              </p>
            )}
            {panLookupStatus.status === "error" && (
              <p className="text-red-600 text-sm mt-1">
                {panLookupStatus.message}
              </p>
            )}

            {loadingDonorLookup && (
              <p className="text-gray-500 text-sm mt-1">Looking up donor…</p>
            )}
          </div>

          {/* ── Donor Name (Read‐Only) ── */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Donor Name</label>
            <input
              type="text"
              name="donorName"
              value={form.donorName}
              readOnly
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-gray-600"
              placeholder="Auto-filled after PAN lookup"
              disabled
            />
          </div>

          {/* ── Amount ── */}
          <input
            type="number"
            name="amount"
            placeholder="Amount"
            value={form.amount}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required
          />

          {/* ── Donation Type ── */}
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
          >
            {donationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* ── Bank Name ── */}
          <input
            type="text"
            name="bankName"
            placeholder="Bank Name"
            value={form.bankName}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required={form.type !== "CASH"}
          />

          {/* ── UTR / Cheque No / Trans Ref ── */}
          <input
            type="text"
            name="utr"
            placeholder="UTR / Cheque No / Trans Ref"
            value={form.utr}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required={form.type !== "CASH"}
          />

          {/* ── IFSC Code ── */}
          <input
            type="text"
            name="ifsc"
            placeholder="IFSC Code"
            value={form.ifsc}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required={form.type !== "CASH"}
          />

          {/* ── Donation Date ── */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Donation Date
            </label>
            <input
              type="date"
              name="donationDate"
              value={form.donationDate}
              onChange={handleChange}
              className="border border-gray-300 rounded-lg px-4 py-2"
              disabled={formLoading}
              required
            />
          </div>

          {/* ── Donation Received ── */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Donation Received
            </label>
            <select
              name="donationReceived"
              value={form.donationReceived}
              onChange={handleChange}
              className="border border-gray-300 rounded-lg px-4 py-2"
              disabled={formLoading}
              required
            >
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
            </select>
          </div>

          {/* ── Transaction Date (only if RECEIVED) ── */}
          {form.donationReceived === "RECEIVED" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                name="transactionDate"
                value={form.transactionDate}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-4 py-2"
                disabled={formLoading}
                required
              />
            </div>
          )}

          {/* ── Submit Button ── */}
          <div className="md:col-span-2 flex justify-end space-x-4">
            <button
              type="button"
              onClick={clearForm}
              disabled={formLoading}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition-opacity"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-opacity ${
                formLoading ? "opacity-50" : "opacity-100"
              }`}
            >
              {editId
                ? formLoading
                  ? "Updating..."
                  : "Update Donation"
                : formLoading
                ? "Adding..."
                : "Add Donation"}
            </button>
          </div>
        </form>
      </div>

      {/* ── RECENT DONATIONS TABLE ── */}
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">
            Recent Donations
          </h2>
          <button
            onClick={fetchDonations}
            disabled={fetchingDonations}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
          >
            <ArrowPathIcon
              className={`h-5 w-5 ${fetchingDonations ? "animate-spin" : ""}`}
            />
            <span className="text-sm">
              {fetchingDonations ? "Refreshing..." : "Refresh"}
            </span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2">Donor Name</th>
                <th className="px-4 py-2">PAN</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Bank Name</th>
                <th className="px-4 py-2">UTR / Cheque No / Trans Ref</th>
                <th className="px-4 py-2">IFSC</th>
                <th className="px-4 py-2">Donation Date</th>
                <th className="px-4 py-2">Received Status</th>
                <th className="px-4 py-2">Transaction Date</th>
                <th className="px-4 py-2 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.length === 0 && !fetchingDonations ? (
                <tr>
                  <td
                    colSpan="11"
                    className="px-4 py-4 text-center text-gray-400"
                  >
                    No donations recorded yet.
                  </td>
                </tr>
              ) : (
                donations.map((d) => (
                  <tr key={d.id} className="border-t group hover:bg-gray-50">
                    <td className="px-4 py-2">{d.donor.fullName}</td>
                    <td className="px-4 py-2">{d.donor.pan}</td>
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
                    <td className="px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(d.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
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

export default AddDonation;
