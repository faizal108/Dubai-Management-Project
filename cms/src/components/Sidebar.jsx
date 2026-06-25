import React, { useEffect, useState } from "react";
import {
  HomeIcon,
  UserPlusIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  BuildingOffice2Icon,
  UsersIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  IdentificationIcon,
  ChevronDownIcon,
  HeartIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../constants/roles";
import { PERMISSIONS } from "../constants/permissions";
import { usePermissions } from "../hooks/usePermissions";

// Navigation tree. Each node is either a leaf `item` (with `path`) or a
// `group` containing nested items. Visibility for items is gated on role +
// permission; groups disappear automatically when none of their children
// pass the filter so empty section headers never render.
const navTree = [
  {
    kind: "item",
    name: "Dashboard",
    icon: <HomeIcon className="h-5 w-5" />,
    path: "/dashboard",
    role: [ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE],
    perm: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    kind: "group",
    name: "Donor",
    icon: <HeartIcon className="h-5 w-5" />,
    items: [
      {
        name: "Add Donor",
        icon: <UserPlusIcon className="h-5 w-5" />,
        path: "/donor/add",
        role: [ROLES.ADMIN, ROLES.EMPLOYEE],
        perm: PERMISSIONS.DONOR_CREATE,
      },
      {
        name: "Donor History",
        icon: <IdentificationIcon className="h-5 w-5" />,
        path: "/donor-history",
        role: [ROLES.ADMIN, ROLES.EMPLOYEE],
      },
    ],
  },
  {
    kind: "group",
    name: "Donation",
    icon: <BanknotesIcon className="h-5 w-5" />,
    items: [
      {
        name: "Add Donation",
        icon: <PlusCircleIcon className="h-5 w-5" />,
        path: "/donation/add",
        role: [ROLES.ADMIN, ROLES.EMPLOYEE],
        perm: PERMISSIONS.DONATION_CREATE,
      },
      {
        name: "All Donations",
        icon: <MagnifyingGlassIcon className="h-5 w-5" />,
        path: "/donation/search",
        role: [ROLES.ADMIN, ROLES.EMPLOYEE],
      },
    ],
  },
  {
    kind: "item",
    name: "Activities",
    icon: <RocketLaunchIcon className="h-5 w-5" />,
    path: "/activities",
    role: [ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.EMPLOYEE],
  },
  {
    kind: "group",
    name: "Administration",
    icon: <ShieldCheckIcon className="h-5 w-5" />,
    items: [
      {
        name: "Employees",
        icon: <IdentificationIcon className="h-5 w-5" />,
        path: "/employees",
        role: [ROLES.ADMIN, ROLES.SUPERADMIN],
      },
      {
        name: "Foundations",
        icon: <BuildingOffice2Icon className="h-5 w-5" />,
        path: "/foundations",
        role: [ROLES.SUPERADMIN],
      },
      {
        name: "Admins",
        icon: <UsersIcon className="h-5 w-5" />,
        path: "/admins",
        role: [ROLES.SUPERADMIN],
      },
      {
        name: "Audit Log",
        icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
        path: "/audits",
        role: [ROLES.SUPERADMIN],
      },
    ],
  },
];

const navItemsBottom = [
  {
    name: "Settings",
    icon: <Cog6ToothIcon className="h-5 w-5" />,
    path: "/settings",
  },
  {
    name: "Profile",
    icon: <UserCircleIcon className="h-5 w-5" />,
    path: "/profile",
  },
  {
    name: "Logout",
    icon: <ArrowRightStartOnRectangleIcon className="h-5 w-5" />,
    action: "logout",
  },
];

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState({});
  const location = useLocation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const isActive = (path) => location.pathname.startsWith(path);

  // Combined role + permission filter used to decide which menu items render.
  const itemVisible = (item) => {
    if (!user) return false;
    if (Array.isArray(item.role) && !item.role.includes(user.role)) return false;
    if (item.perm && !can(item.perm)) return false;
    return true;
  };

  // Apply role/permission filtering to the tree and drop any groups whose
  // children are all hidden, so empty section headers never render.
  const visibleTree = navTree
    .map((node) => {
      if (node.kind === "item") return itemVisible(node) ? node : null;
      const items = node.items.filter(itemVisible);
      return items.length ? { ...node, items } : null;
    })
    .filter(Boolean);

  // Auto-expand the group containing the active route whenever the path
  // changes. We merge into existing state so a user's manual toggles on
  // other groups stick around between navigations.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const node of visibleTree) {
        if (node.kind !== "group") continue;
        if (node.items.some((it) => isActive(it.path))) next[node.name] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (name) =>
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  function handleLogout(e) {
    e.preventDefault();
    logout();
    navigate("/login");
  }

  const navLinkClass = (active, { nested = false } = {}) =>
    [
      "group flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
      isOpen ? (nested ? "justify-start pl-9 pr-3" : "justify-start px-3") : "justify-center px-3",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    ].join(" ");

  // Flat list of every visible leaf — used when the sidebar is collapsed so
  // child items render as a single icon strip without group headers.
  const flatItems = visibleTree.flatMap((node) =>
    node.kind === "item" ? [node] : node.items
  );

  return (
    <aside
      className={`flex h-screen flex-col border-r border-border bg-card transition-[width] duration-200 ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Header / brand */}
      <div
        className={`flex h-16 items-center gap-2 border-b border-border px-4 ${
          isOpen ? "justify-between" : "justify-center"
        }`}
      >
        {isOpen && (
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              D
            </span>
            <span className="text-sm font-semibold text-foreground">
              Donation CMS
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {isOpen ? (
            <XMarkIcon className="h-5 w-5" />
          ) : (
            <Bars3Icon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Highlighted primary action — anyone with donation:create. */}
      {can(PERMISSIONS.DONATION_CREATE) && (
        <div className="px-3 pt-3">
          <Link
            to="/donation/add"
            className={`flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
              isOpen ? "" : "px-2"
            }`}
          >
            <PlusCircleIcon className="h-5 w-5" />
            {isOpen && <span>Add Donation</span>}
          </Link>
        </div>
      )}

      {/* Top Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {isOpen ? (
          <ul className="flex flex-col gap-0.5">
            {visibleTree.map((node) => {
              if (node.kind === "item") {
                return (
                  <li key={node.name}>
                    <Link
                      to={node.path}
                      className={navLinkClass(isActive(node.path))}
                    >
                      {node.icon}
                      <span>{node.name}</span>
                    </Link>
                  </li>
                );
              }
              const expanded = !!openGroups[node.name];
              const groupActive = node.items.some((it) => isActive(it.path));
              return (
                <li key={node.name}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(node.name)}
                    aria-expanded={expanded}
                    className={[
                      "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      groupActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {node.icon}
                    <span className="flex-1 text-left">{node.name}</span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expanded && (
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {node.items.map((it) => (
                        <li key={it.name}>
                          <Link
                            to={it.path}
                            className={navLinkClass(isActive(it.path), {
                              nested: true,
                            })}
                          >
                            {it.icon}
                            <span>{it.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {flatItems.map(({ name, icon, path }) => (
              <li key={name}>
                <Link
                  to={path}
                  className={navLinkClass(isActive(path))}
                  title={name}
                >
                  {icon}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Bottom Links */}
      <div className="border-t border-border px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {navItemsBottom.map(({ name, icon, path, action }) => {
            const active = path ? isActive(path) : false;
            if (action === "logout") {
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`w-full ${navLinkClass(false)}`}
                    title={!isOpen ? name : undefined}
                  >
                    {icon}
                    {isOpen && <span>{name}</span>}
                  </button>
                </li>
              );
            }
            return (
              <li key={name}>
                <Link
                  to={path}
                  className={navLinkClass(active)}
                  title={!isOpen ? name : undefined}
                >
                  {icon}
                  {isOpen && <span>{name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* User footer */}
        {isOpen && user && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
