// src/pages/AddDonor.jsx

import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  addDonor,
  deleteDonor,
  getAllDonors,
  updateDonor,
} from "../apis/endpoints";
import RoleGuard from "../components/RoleGuard";
import { ROLES } from "../constants/roles";

const countryStateCity = {
  India: {
    Maharashtra: ["Mumbai", "Pune", "Nagpur"],
    Gujarat: ["Ahmedabad", "Surat"],
  },
  USA: {
    California: ["Los Angeles", "San Francisco"],
    Texas: ["Dallas", "Austin"],
  },
};

const initialForm = {
  fullName: "",
  address1: "",
  address2: "",
  pan: "",
  phone: "",
  country: "",
  state: "",
  city: "",
};

const AddDonor = () => {
  const [form, setForm] = useState(initialForm);
  const [donors, setDonors] = useState([]);
  const [editId, setEditId] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const fetchDonors = async () => {
    setIsFetching(true);
    try {
      const data = await getAllDonors();
      setDonors(data.donors || []);
    } catch (err) {
      console.error("Fetch donors error:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "country") {
      setForm({
        ...form,
        country: value,
        state: "",
        city: "",
      });
    } else if (name === "state") {
      setForm({
        ...form,
        state: value,
        city: "",
      });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const requiredFields = [
      "fullName",
      "address1",
      "pan",
      "country",
      "state",
      "city",
    ];
    for (const field of requiredFields) {
      if (!form[field].trim()) {
        toast.warn(`${field} is required.`);
        return;
      }
      if (form.phone && !/^\d{10}$/.test(form.phone)) {
        toast.warn("Phone number must be exactly 10 digits or leave it blank.");
        return;
      }
    }

    setFormLoading(true);

    try {
      if (editId) {
        await updateDonor(editId, form);
        toast.success("Donor updated successfully.");
      } else {
        await addDonor(form);
        toast.success("Donor added successfully.");
      }

      setForm(initialForm);
      setEditId(null);
      await fetchDonors();
    } catch (err) {
      console.error("Form submit error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (donor) => {
    setForm({
      fullName: donor.fullName || "",
      address1: donor.address1 || "",
      address2: donor.address2 || "",
      pan: donor.pan || "",
      phone: donor.phone || "",
      country: donor.country || "",
      state: donor.state || "",
      city: donor.city || "",
    });
    setEditId(donor.id);
  };

  const handleDelete = async (donorId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this donor? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteDonor(donorId);
      toast.info("Donor deleted.");
      setDonors((prev) => prev.filter((d) => d.id !== donorId));
      if (editId === donorId) {
        setForm(initialForm);
        setEditId(null);
      }
    } catch (err) {
      console.error("Delete donor error:", err);
    }
  };

  const availableCountries = Object.keys(countryStateCity);
  const availableStates = form.country
    ? Object.keys(countryStateCity[form.country])
    : [];
  const availableCities =
    form.country && form.state
      ? countryStateCity[form.country][form.state]
      : [];

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-md">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {editId ? "Update Donor" : "Add Donor"}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input
            type="text"
            name="fullName"
            placeholder="Full Name"
            value={form.fullName}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required
          />
          <input
            type="text"
            name="address1"
            placeholder="Address Line 1"
            value={form.address1}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required
          />
          <input
            type="text"
            name="address2"
            placeholder="Address Line 2 (Optional)"
            value={form.address2}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
          />
          <input
            type="text"
            name="pan"
            placeholder="PAN Number"
            value={form.pan}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => {
              const input = e.target.value;
              if (input === "" || /^\d{0,10}$/.test(input)) {
                handleChange(e);
              }
            }}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            maxLength={10}
          />

          {/* Country Dropdown */}
          <select
            name="country"
            value={form.country}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading}
            required
          >
            <option value="">Select Country</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* State Dropdown */}
          <select
            name="state"
            value={form.state}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading || !form.country}
            required
          >
            <option value="">Select State</option>
            {availableStates.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* City Dropdown */}
          <select
            name="city"
            value={form.city}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2"
            disabled={formLoading || !form.state}
            required
          >
            <option value="">Select City</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <div className="md:col-span-2 flex justify-end gap-4 items-center">
            <div className="space-x-2">
              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setEditId(null);
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg"
                disabled={formLoading}
              >
                Clear
              </button>
              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(initialForm);
                    setEditId(null);
                    toast.info("Edit cancelled.");
                  }}
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-medium px-4 py-2 rounded-lg"
                  disabled={formLoading}
                >
                  Cancel Edit
                </button>
              )}
            </div>
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
                  : "Update Donor"
                : formLoading
                ? "Adding..."
                : "Add Donor"}
            </button>
          </div>
        </form>
      </div>

      <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
        <div className="bg-white p-6 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Recent Donors
            </h2>
            <button
              onClick={fetchDonors}
              disabled={isFetching}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 focus:outline-none"
            >
              {isFetching ? (
                <svg
                  className="animate-spin h-5 w-5 text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8v-8H4z"
                  />
                </svg>
              ) : (
                <ArrowPathIcon className="h-5 w-5" />
              )}
              <span className="text-sm">
                {isFetching ? "Loading..." : "Reload"}
              </span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-2">Full Name</th>
                  <th className="px-4 py-2">Address 1</th>
                  <th className="px-4 py-2">Address 2</th>
                  <th className="px-4 py-2">PAN</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">Country</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {donors.length === 0 && !isFetching ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-4 text-center text-gray-400"
                    >
                      No donors available.
                    </td>
                  </tr>
                ) : (
                  donors?.map((donor) => (
                    <tr
                      key={donor.id}
                      className="border-t group hover:bg-gray-50"
                    >
                      <td className="px-4 py-2">{donor.fullName}</td>
                      <td className="px-4 py-2">{donor.address1}</td>
                      <td className="px-4 py-2">{donor.address2 || "-"}</td>
                      <td className="px-4 py-2">{donor.pan}</td>
                      <td className="px-4 py-2">{donor.phone}</td>
                      <td className="px-4 py-2">{donor.country}</td>
                      <td className="px-4 py-2">{donor.state}</td>
                      <td className="px-4 py-2">{donor.city}</td>
                      <td className="px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleEdit(donor)}
                          className="text-blue-600 hover:underline mr-4"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(donor.id)}
                          className="text-red-600 hover:underline"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </RoleGuard>
    </div>
  );
};

export default AddDonor;
