import React, { useState } from "react";

const LoginForm = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const validate = () => {
    const errs = {};
    if (!identifier.trim()) errs.identifier = "Username or email is required";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6)
      errs.password = "Password must be at least 6 characters";

    // Basic email format check if looks like email
    if (
      identifier.includes("@") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())
    ) {
      errs.identifier = "Invalid email format";
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
      // Simulate API call
      await new Promise((res) => setTimeout(res, 1000));

      // TODO: Replace with real auth call:
      // const response = await authApi.login({ identifier, password });
      // if (response.success) onLogin(response.data);

      if (identifier !== "admin" && identifier !== "admin@example.com") {
        throw new Error("User not found");
      }
      if (password !== "password123") {
        throw new Error("Invalid password");
      }

      onLogin && onLogin({ identifier });
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg mt-20">
      <h2 className="text-2xl font-semibold mb-6 text-center">Login</h2>
      {loginError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {loginError}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label
            htmlFor="identifier"
            className="block text-sm font-medium mb-1"
          >
            Username or Email
          </label>
          <input
            type="text"
            id="identifier"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
              errors.identifier
                ? "border-red-500 focus:ring-red-500"
                : "focus:ring-indigo-500"
            }`}
            autoComplete="username"
            disabled={loading}
          />
          {errors.identifier && (
            <p className="text-red-600 text-xs mt-1">{errors.identifier}</p>
          )}
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
              errors.password
                ? "border-red-500 focus:ring-red-500"
                : "focus:ring-indigo-500"
            }`}
            autoComplete="current-password"
            disabled={loading}
          />
          {errors.password && (
            <p className="text-red-600 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
