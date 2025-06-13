import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Textarea,
  Typography,
} from "@material-tailwind/react";

export default function DonorForm({
  isUpdate = false,
  onSave,
  onCancel,
  initialValues = null,
}) {
  const [form, setForm] = useState({
    fullName: "",
    address1: "",
    address2: "",
    address3: "",
    country: "",
    state: "",
    city: "",
    pan: "",
    amount: "",           // ← added
    remarks: "",
    bankName: "",
    utr: "",
    ifsc: "",
  });
  const [errors, setErrors] = useState({});

  // Populate form when initialValues change (for edit)
  useEffect(() => {
    if (initialValues) {
      setForm((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  const validate = () => {
    const errs = {};
    if (!form.fullName) errs.fullName = "Full Name is required.";
    else if (form.fullName.length > 100) errs.fullName = "Maximum 100 characters allowed.";
    if (!form.address1) errs.address1 = "Address Line 1 is required.";
    if (!form.country) errs.country = "Country is required.";
    if (!form.state) errs.state = "State is required.";
    if (!form.city) errs.city = "City is required.";
    if (!form.pan) errs.pan = "PAN Card is required.";
    if (!form.amount) errs.amount = "Amount is required.";         // ← added
    if (!form.bankName) errs.bankName = "Bank Name is required.";
    if (!form.utr) errs.utr = "UTR / Transaction Number is required.";
    if (!form.ifsc) errs.ifsc = "IFSC Code / Branch Name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSave(form);
  };

  return (
    <form
      className="w-full mx-auto p-6 bg-white shadow-md rounded-lg space-y-8"
      onSubmit={handleSubmit}
    >
      {/* Donor Detail Section */}
      <div>
        <Typography variant="h5" className="mb-4">
          Donor Details
        </Typography>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div>
            <Input
              label="Full Name *"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              error={Boolean(errors.fullName)}
            />
            {errors.fullName && (
              <Typography color="red" variant="small">
                {errors.fullName}
              </Typography>
            )}
          </div>

          {/* Address Line 1 */}
          <div>
            <Input
              label="Address Line 1 *"
              name="address1"
              value={form.address1}
              onChange={handleChange}
              error={Boolean(errors.address1)}
            />
            {errors.address1 && (
              <Typography color="red" variant="small">
                {errors.address1}
              </Typography>
            )}
          </div>

          {/* Address Line 2 */}
          <div>
            <Input
              label="Address Line 2"
              name="address2"
              value={form.address2}
              onChange={handleChange}
            />
          </div>

          {/* Address Line 3 */}
          <div>
            <Input
              label="Address Line 3"
              name="address3"
              value={form.address3}
              onChange={handleChange}
            />
          </div>

          {/* Country */}
          <div>
            <Input
              label="Country *"
              name="country"
              value={form.country}
              onChange={handleChange}
              error={Boolean(errors.country)}
            />
            {errors.country && (
              <Typography color="red" variant="small">
                {errors.country}
              </Typography>
            )}
          </div>

          {/* State */}
          <div>
            <Input
              label="State *"
              name="state"
              value={form.state}
              onChange={handleChange}
              error={Boolean(errors.state)}
            />
            {errors.state && (
              <Typography color="red" variant="small">
                {errors.state}
              </Typography>
            )}
          </div>

          {/* City */}
          <div>
            <Input
              label="City *"
              name="city"
              value={form.city}
              onChange={handleChange}
              error={Boolean(errors.city)}
            />
            {errors.city && (
              <Typography color="red" variant="small">
                {errors.city}
              </Typography>
            )}
          </div>

          {/* PAN Card */}
          <div>
            <Input
              label="PAN Card *"
              name="pan"
              value={form.pan}
              onChange={handleChange}
              error={Boolean(errors.pan)}
            />
            {errors.pan && (
              <Typography color="red" variant="small">
                {errors.pan}
              </Typography>
            )}
          </div>

          {/* Amount */}
          <div>
            <Input
              label="Amount *"
              name="amount"
              type="number"
              value={form.amount}
              onChange={handleChange}
              error={Boolean(errors.amount)}
            />
            {errors.amount && (
              <Typography color="red" variant="small">
                {errors.amount}
              </Typography>
            )}
          </div>

          {/* Remarks */}
          <div className="md:col-span-2">
            <Textarea
              label="Instruction / Remarks"
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Bank Details Section */}
      <div>
        <Typography variant="h5" className="mb-4">
          Bank Details
        </Typography>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bank Name */}
          <div>
            <Input
              label="Bank Name *"
              name="bankName"
              value={form.bankName}
              onChange={handleChange}
              error={Boolean(errors.bankName)}
            />
            {errors.bankName && (
              <Typography color="red" variant="small">
                {errors.bankName}
              </Typography>
            )}
          </div>
          {/* UTR */}
          <div>
            <Input
              label="UTR / Transaction Number *"
              name="utr"
              value={form.utr}
              onChange={handleChange}
              error={Boolean(errors.utr)}
            />
            {errors.utr && (
              <Typography color="red" variant="small">
                {errors.utr}
              </Typography>
            )}
          </div>
          {/* IFSC */}
          <div className="md:col-span-2">
            <Input
              label="IFSC Code / Branch Name *"
              name="ifsc"
              value={form.ifsc}
              onChange={handleChange}
              error={Boolean(errors.ifsc)}
            />
            {errors.ifsc && (
              <Typography color="red" variant="small">
                {errors.ifsc}
              </Typography>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outlined" onClick={onCancel} className="rounded-lg">
          Cancel
        </Button>
        <Button type="submit" className="rounded-lg">
          {isUpdate ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}
