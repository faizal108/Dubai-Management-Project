import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Layout = () => {
  const year = new Date().getFullYear();
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col p-6">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            &copy; {year} Toran Software Services Pvt. Ltd. All rights reserved.
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Layout;
