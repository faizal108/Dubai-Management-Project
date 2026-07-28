import React, { useEffect } from "react";
import {
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useFinancialYear } from "../context/FinancialYearContext";
import FinancialYearSelect from "../features/financialYears/components/FinancialYearSelect";
import { Dropdown, DropdownSection, DropdownItem } from "./ui";

// Top bar: theme toggle, financial-year selector, then the profile menu
// (Profile / Settings / Logout) — in that order, right-aligned, mirroring
// the layout of most dashboard products. Sits above <Outlet/> in Layout.jsx;
// the sidebar keeps only page navigation.
const Navbar = () => {
  const { user, logout } = useAuth();
  const { resolvedMode, toggleMode } = useTheme();
  const { years: fyYears, refresh: refreshFyYears } = useFinancialYear();
  const navigate = useNavigate();
  const location = useLocation();

  // Financial years can be auto-created server-side as a side effect of
  // adding a donation/expense (see lib/financialYear.js), with no frontend
  // call site to invalidate this context. Re-checking on every navigation
  // means a year created that way still shows up here without requiring a
  // full page reload or an unrelated edit on the Financial Years page.
  useEffect(() => {
    refreshFyYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate("/login");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-4">
      <button
        type="button"
        onClick={toggleMode}
        aria-label={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {resolvedMode === "dark" ? (
          <SunIcon className="h-5 w-5" />
        ) : (
          <MoonIcon className="h-5 w-5" />
        )}
      </button>

      {fyYears.length > 0 && (
        <div className="w-44">
          <FinancialYearSelect />
        </div>
      )}

      {user && (
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
              title={user.name || user.email}
            >
              {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
            </button>
          }
        >
          <DropdownSection>
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownSection>
          <DropdownSection>
            <DropdownItem icon={<UserCircleIcon className="h-4 w-4" />} to="/profile">
              Profile
            </DropdownItem>
            <DropdownItem icon={<Cog6ToothIcon className="h-4 w-4" />} to="/settings">
              Settings
            </DropdownItem>
          </DropdownSection>
          <DropdownSection>
            <DropdownItem
              icon={<ArrowRightStartOnRectangleIcon className="h-4 w-4" />}
              onClick={handleLogout}
              danger
            >
              Logout
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
      )}
    </header>
  );
};

export default Navbar;
