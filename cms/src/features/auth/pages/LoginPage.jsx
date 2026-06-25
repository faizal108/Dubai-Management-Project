import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../../context/AuthContext";
import {
  Button,
  Card,
  CardBody,
  Input,
  FormField,
} from "../../../components/ui";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Enter a valid email address";
    }
    if (!password) {
      errs.password = "Password is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok) {
        navigate("/");
      } else {
        setLoginError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error("Login Error:", err);
      setLoginError(
        err?.apiError?.message ||
          err?.message ||
          "Something went wrong. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      {/* Decorative gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(circle_at_80%_80%,hsl(var(--primary)/0.12),transparent_55%)]"
      />

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow-soft">
            D
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Donation CMS
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your foundation.
          </p>
        </div>

        <Card>
          <CardBody className="p-6 sm:p-8">
            {loginError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <FormField label="Email" error={errors.email} required>
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  error={!!errors.email}
                  leftIcon={<EnvelopeIcon className="h-4 w-4" />}
                />
              </FormField>

              <FormField label="Password" error={errors.password} required>
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  error={!!errors.password}
                  leftIcon={<LockClosedIcon className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="pointer-events-auto text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  }
                />
              </FormField>

              <Button type="submit" loading={loading} fullWidth size="lg">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by your organization. Contact an administrator for access.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
