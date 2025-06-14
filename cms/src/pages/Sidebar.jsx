import React, { useState } from "react";
import {
  HomeIcon,
  UserPlusIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@material-tailwind/react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import RoleGuard from "../components/RoleGuard";

// Navigation links
const navItemsTop = [
  {
    name: "Dashboard",
    icon: <HomeIcon className="h-5 w-5" />,
    path: "/dashboard",
    role: [ROLES.ADMIN],
  },
  {
    name: "Add Donor",
    icon: <UserPlusIcon className="h-5 w-5" />,
    path: "/donor/add",
    role: [ROLES.USER, ROLES.ADMIN],
  },
  {
    name: "Add Donation",
    icon: <PlusCircleIcon className="h-5 w-5" />,
    path: "/donation/add",
    highlight: true,
    role: [ROLES.USER, ROLES.ADMIN],
  },
  {
    name: "View Donations",
    icon: <EyeIcon className="h-5 w-5" />,
    path: "/view/donations",
    role: [ROLES.USER, ROLES.ADMIN],
  },
  {
    name: "Search Donation",
    icon: <MagnifyingGlassIcon className="h-5 w-5" />,
    path: "/donation/search",
    role: [ROLES.USER, ROLES.ADMIN],
  },
  // {
  //   name: "Donation History",
  //   icon: <ClockIcon className="h-5 w-5" />,
  //   path: "/donation/history",
  // },
  {
    name: "Reports",
    icon: <ChartBarIcon className="h-5 w-5" />,
    path: "/reports",
    role: [ROLES.ADMIN],
  },
  // {
  //   name: "Login",
  //   icon: <ChartBarIcon className="h-5 w-5" />,
  //   path: "/login",
  // },
  {
    name: "Create User",
    icon: <UserIcon className="h-5 w-5" />,
    path: "/createUser",
    role: [ROLES.ADMIN],
  },
];

const navItemsBottom = [
  {
    name: "Profile",
    icon: <UserCircleIcon className="h-5 w-5" />,
    path: "/profile",
  },
  {
    name: "Logout",
    icon: <ArrowRightOnRectangleIcon className="h-5 w-5" />,
    // path: "/logout",
  },
];

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);
  const { logout } = useAuth();
  const navigate = useNavigate();
  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside
      className={`flex flex-col h-screen bg-white border-r shadow-sm transition-all duration-300 ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <span
          className={`text-xl font-bold text-blue-600 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          CMS
        </span>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Highlighted Button */}
      <div className="p-4">
        <Link to="/donation/add">
          <Button
            fullWidth
            color="blue"
            className={`flex items-center justify-center gap-2 rounded-xl transition-all duration-200 shadow-md ${
              isOpen ? "" : "px-2 py-2"
            } ${isActive("/donation/add") ? "bg-blue-600 text-white" : ""}`}
          >
            <PlusCircleIcon className="h-5 w-5" />
            {isOpen && <span>Add Donation</span>}
          </Button>
        </Link>
      </div>

      {/* Top Links */}
      <nav className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1 p-2">
          {navItemsTop.map(({ name, icon, path, role }) => (
            <RoleGuard allowedRoles={role}>
              <li key={name}>
                <Link
                  to={path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition ${
                    isActive(path)
                      ? "bg-blue-100 text-blue-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {icon}
                  {isOpen && <span>{name}</span>}
                </Link>
              </li>
            </RoleGuard>
          ))}
        </ul>
      </nav>

      {/* Bottom Links */}
      <div className="p-2 border-t">
        <ul className="flex flex-col gap-1">
          {navItemsBottom.map(({ name, icon, path }) => (
            <li key={name}>
              <Link
                to={path}
                className={`flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive(path)
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
                onClick={name === "Logout" ? handleLogout : undefined}
              >
                {icon}
                {isOpen && <span>{name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
