import React, { useState } from "react";

const roleOptions = ["ADMIN", "MANAGER", "STAFF", "VIEWER"]; // You can fetch this from API as well

const initialForm = {
  username: "",
  email: "",
  password: "",
  roles: [],
  desc: "",
};

const CreateUser = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [createdUsers, setCreatedUsers] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleToggle = (role) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const validate = () => {
    const err = {};
    if (!form.username.trim()) err.username = "Username is required";
    if (!form.email.trim()) err.email = "Email is required";
    if (!form.password.trim()) err.password = "Password is required";
    if (form.roles.length === 0) err.roles = "At least one role is required";
    return err;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Simulated API POST
    setCreatedUsers((prev) => [{ id: Date.now(), ...form }, ...prev]);
    setForm(initialForm);
    setErrors({});
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="bg-white shadow-md rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Create New User
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded-lg"
            />
            {errors.username && (
              <p className="text-red-500 text-sm">{errors.username}</p>
            )}
          </div>
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded-lg"
            />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email}</p>
            )}
          </div>
          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded-lg"
            />
            {errors.password && (
              <p className="text-red-500 text-sm">{errors.password}</p>
            )}
          </div>
          <div>
            <label className="block mb-1 font-medium text-gray-600">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => (
                <label
                  key={role}
                  className={`px-3 py-1 border rounded-full cursor-pointer ${
                    form.roles.includes(role)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    value={role}
                    checked={form.roles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                    className="hidden"
                  />
                  {role}
                </label>
              ))}
            </div>
            {errors.roles && (
              <p className="text-red-500 text-sm mt-1">{errors.roles}</p>
            )}
          </div>
          <div>
            <textarea
              name="desc"
              placeholder="Description (optional)"
              value={form.desc}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded-lg"
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Create User
          </button>
        </form>
      </div>

      {/* Simulated Preview List */}
      {createdUsers.length > 0 && (
        <div className="bg-white shadow-md rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Created Users
          </h2>
          <ul className="divide-y divide-gray-200">
            {createdUsers.map((user) => (
              <li key={user.id} className="py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <p className="text-sm text-gray-400">
                      Roles: {user.roles.join(", ")}
                    </p>
                    {user.desc && (
                      <p className="text-sm italic text-gray-400">
                        {user.desc}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{user.id}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CreateUser;
