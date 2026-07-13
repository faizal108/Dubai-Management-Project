// src/features/auth/pages/ProfilePage.jsx
//
// Self-service profile page. Any authenticated user can edit their
// fullName / username / email and change their password here. Role,
// foundationId, and isActive are read-only — those are managed by a
// SUPERADMIN via the admins module.

import React, { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { updateProfile, changePassword } from "../api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PageHeader,
} from "../../../components/ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldErr = (errors, name) => errors?.[name]?.[0];

const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  // Profile form — seeded from the cached user.
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || "",
    username: user?.username || "",
    email: user?.email || "",
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileBusy, setProfileBusy] = useState(false);

  // Password form.
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdBusy, setPwdBusy] = useState(false);

  const onProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((p) => ({ ...p, [name]: value }));
    setProfileErrors((p) => ({ ...p, [name]: undefined }));
  };

  const onPwdChange = (e) => {
    const { name, value } = e.target;
    setPwdForm((p) => ({ ...p, [name]: value }));
    setPwdErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!profileForm.fullName.trim() || profileForm.fullName.trim().length < 2) {
      errs.fullName = ["Full name must be at least 2 characters"];
    }
    if (!EMAIL_REGEX.test(profileForm.email.trim())) {
      errs.email = ["Enter a valid email address"];
    }
    if (profileForm.username.trim() && profileForm.username.trim().length < 3) {
      errs.username = ["Username must be at least 3 characters"];
    }
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Only send changed fields. Backend rejects an empty payload.
    const payload = {};
    if (profileForm.fullName.trim() !== (user?.fullName || "")) {
      payload.fullName = profileForm.fullName.trim();
    }
    if (profileForm.email.trim().toLowerCase() !== (user?.email || "")) {
      payload.email = profileForm.email.trim().toLowerCase();
    }
    const nextUsername = profileForm.username.trim() || null;
    if (nextUsername !== (user?.username || null)) {
      payload.username = nextUsername;
    }
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save.");
      return;
    }

    setProfileBusy(true);
    try {
      const res = await updateProfile(payload);
      if (res?.user) updateUser(res.user);
      toast.success("Profile updated.");
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setProfileErrors(envelope.details.fieldErrors);
      }
      console.error("Update profile error:", err);
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwdForm.currentPassword) {
      errs.currentPassword = ["Current password is required"];
    }
    if (!pwdForm.newPassword || pwdForm.newPassword.length < 8) {
      errs.newPassword = ["New password must be at least 8 characters"];
    }
    if (pwdForm.newPassword && pwdForm.newPassword === pwdForm.currentPassword) {
      errs.newPassword = ["New password must differ from current password"];
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      errs.confirmPassword = ["Passwords do not match"];
    }
    setPwdErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPwdBusy(true);
    try {
      await changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed.");
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setPwdErrors(envelope.details.fieldErrors);
      }
      console.error("Change password error:", err);
    } finally {
      setPwdBusy(false);
    }
  };

  // Account-level read-only metadata — kept in a single block so the visual
  // hierarchy mirrors the editable / non-editable boundary in the schema.
  const readOnlyRows = [
    { label: "Role", value: user?.role || "—" },
    { label: "Foundation ID", value: user?.foundationId || "—" },
    { label: "Status", value: user?.isActive ? "Active" : "Inactive" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Update your account details and password."
      />

      {/* Profile details */}
      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            id="profile-form"
            onSubmit={handleProfileSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <FormField
              label="Full name"
              required
              error={fieldErr(profileErrors, "fullName")}
            >
              <Input
                type="text"
                name="fullName"
                value={profileForm.fullName}
                onChange={onProfileChange}
                disabled={profileBusy}
                autoComplete="name"
                error={!!fieldErr(profileErrors, "fullName")}
              />
            </FormField>
            <FormField
              label="Username"
              error={fieldErr(profileErrors, "username")}
            >
              <Input
                type="text"
                name="username"
                value={profileForm.username}
                onChange={onProfileChange}
                disabled={profileBusy}
                autoComplete="username"
                placeholder="Optional"
                error={!!fieldErr(profileErrors, "username")}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField
                label="Email"
                required
                error={fieldErr(profileErrors, "email")}
              >
                <Input
                  type="email"
                  name="email"
                  value={profileForm.email}
                  onChange={onProfileChange}
                  disabled={profileBusy}
                  autoComplete="email"
                  error={!!fieldErr(profileErrors, "email")}
                />
              </FormField>
            </div>

            {/* Read-only account metadata */}
            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3 md:col-span-2">
              {readOnlyRows.map((row) => (
                <div key={row.label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </p>
                  {row.label === "Status" ? (
                    <Badge variant={user?.isActive ? "success" : "default"}>
                      {row.value}
                    </Badge>
                  ) : (
                    <p className="break-all font-mono text-sm text-foreground">
                      {row.value}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </form>
        </CardBody>
        <CardFooter className="justify-end">
          <Button type="submit" form="profile-form" loading={profileBusy}>
            Save changes
          </Button>
        </CardFooter>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            id="password-form"
            onSubmit={handlePwdSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <FormField
                label="Current password"
                required
                error={fieldErr(pwdErrors, "currentPassword")}
              >
                <Input
                  type="password"
                  name="currentPassword"
                  value={pwdForm.currentPassword}
                  onChange={onPwdChange}
                  disabled={pwdBusy}
                  autoComplete="current-password"
                  error={!!fieldErr(pwdErrors, "currentPassword")}
                />
              </FormField>
            </div>
            <FormField
              label="New password"
              required
              hint="Minimum 8 characters."
              error={fieldErr(pwdErrors, "newPassword")}
            >
              <Input
                type="password"
                name="newPassword"
                value={pwdForm.newPassword}
                onChange={onPwdChange}
                disabled={pwdBusy}
                autoComplete="new-password"
                error={!!fieldErr(pwdErrors, "newPassword")}
              />
            </FormField>
            <FormField
              label="Confirm new password"
              required
              error={fieldErr(pwdErrors, "confirmPassword")}
            >
              <Input
                type="password"
                name="confirmPassword"
                value={pwdForm.confirmPassword}
                onChange={onPwdChange}
                disabled={pwdBusy}
                autoComplete="new-password"
                error={!!fieldErr(pwdErrors, "confirmPassword")}
              />
            </FormField>
          </form>
        </CardBody>
        <CardFooter className="justify-end">
          <Button type="submit" form="password-form" loading={pwdBusy}>
            Change password
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ProfilePage;
