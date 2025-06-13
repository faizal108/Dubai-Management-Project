import React, { useState, useEffect } from "react";
import DonorForm from "../components/DonorForm";
import CommonTable from "../components/CommonTable";

const STORAGE_KEY = "donor_records";

export default function DonorPage() {
  const [records, setRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isUpdate, setIsUpdate] = useState(false);
  const [initialValues, setInitialValues] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setRecords(JSON.parse(saved));
  }, []);

  // Save to localStorage when records change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const clearForm = () => {
    setEditingRecord(null);
    setIsUpdate(false);
    setInitialValues(null);
  };

  const handleSave = (data) => {
    if (isUpdate && editingRecord !== null) {
      const updated = records.map((r, i) => (i === editingRecord ? data : r));
      setRecords(updated);
    } else {
      setRecords([data, ...records]);
    }
    clearForm();
  };

  const handleCancel = () => {
    clearForm();
  };

  const handleEdit = (row, index) => {
    setEditingRecord(index);
    setIsUpdate(true);
    setInitialValues(row);
  };

  const handleDelete = (index) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      const filtered = records.filter((_, i) => i !== index);
      setRecords(filtered);
    }
  };

  const handlePrint = (row) => {
    // Simple print logic
    const printContent = JSON.stringify(row, null, 2);
    const win = window.open("", "_blank");
    win.document.write(`<pre>${printContent}</pre>`);
    win.document.close();
    win.print();
  };

  // Define table columns dynamically based on form fields
  const columns = [
    { key: "fullName", label: "Name" },
    { key: "address1", label: "Address" },
    { key: "amount", label: "Amount" },
    { key: "pan", label: "PAN Card" },
    { key: "bankName", label: "Bank Name" },
    { key: "utr", label: "UTR / Transaction No." },
    { key: "ifsc", label: "IFSC / Branch" },
  ];

  useEffect(() => {
    if (!localStorage.getItem("donor_records")) {
      const dummyDonors = Array.from({ length: 55 }, (_, i) => ({
        fullName: `Donor ${i + 1}`,
        address1: `Address line ${i + 1}, City ${i + 1}, Country`,
        amount: (1000 + i * 50).toString(),
        pan: `ABCDE${1000 + i}F`,
        bankName: `Bank ${(i % 5) + 1}`,
        utr: `UTR${Math.floor(Math.random() * 1000000000)}`,
        ifsc: `IFSC000${i % 10}`,
      }));
      localStorage.setItem("donor_records", JSON.stringify(dummyDonors));
    }
  }, []);

  return (
    <div className="p-8 space-y-8">
      <DonorForm
        key={editingRecord ?? "new"}
        isUpdate={isUpdate}
        onSave={handleSave}
        onCancel={handleCancel}
        initialValues={initialValues}
      />

      <CommonTable
        data={records}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPrint={handlePrint}
      />
    </div>
  );
}
