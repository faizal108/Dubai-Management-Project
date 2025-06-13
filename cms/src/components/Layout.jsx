import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/Sidebar";

const Layout = () => {
  return (
    <div className="flex w-full h-screen">
      <Sidebar />
      <main className="flex-1 p-6 bg-gray-50 min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
