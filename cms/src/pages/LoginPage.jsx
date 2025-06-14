import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const errs = {};
    if (!username.trim()) {
      errs.username = "Username is required";
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
      // Save token and user context
      await login(username, password)
        ? console.log("Login successful")
        : console.log("Login failed");

      navigate("/");
    } catch (err) {
      console.error("Login Error:", err);
      setLoginError(
        err?.message || "Something went wrong. Please try again later."
      );
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
        {/* username Input */}
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${
              errors.username
                ? "border-red-500 focus:ring-red-500"
                : "focus:ring-indigo-500"
            }`}
            autoComplete="username"
            disabled={loading}
          />
          {errors.username && (
            <p className="text-red-600 text-xs mt-1">{errors.username}</p>
          )}
        </div>

        {/* Password Input */}
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

        {/* Submit Button */}
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

export default LoginPage;
