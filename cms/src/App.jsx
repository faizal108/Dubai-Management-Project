// src/App.jsx

import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import HomeRedirect from "./components/HomeRedirect";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AddDonor = lazy(() => import("./pages/AddDonor"));
const AddDonation = lazy(() => import("./pages/AddDonation"));
const SearchDonation = lazy(() => import("./pages/SearchDonation"));
const DonationReport = lazy(() => import("./pages/DonationReport"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const CreateUser = lazy(() => import("./pages/CreateUser"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const ViewDonations = lazy(() => import("./pages/ViewDonations"));

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            {/* ─── Public ─────────────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* ─── Protected (Layout) ─────────────────────────────────────────── */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              {/* if we land on “/”, redirect to /dashboard */}
              <Route index element={<HomeRedirect />} />
              <Route
                path="dashboard"
                element={
                  <PrivateRoute roles={["admin"]}>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="donor/add"
                element={
                  <PrivateRoute roles={["admin", "user"]}>
                    <AddDonor />
                  </PrivateRoute>
                }
              />
              <Route
                path="donation/add"
                element={
                  <PrivateRoute roles={["admin", "user"]}>
                    <AddDonation />
                  </PrivateRoute>
                }
              />
              <Route
                path="donation/search"
                element={
                  <PrivateRoute roles={["admin", "user"]}>
                    <SearchDonation />
                  </PrivateRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <PrivateRoute roles={["admin"]}>
                    <DonationReport />
                  </PrivateRoute>
                }
              />
              {/* Only admin can createUser */}
              <Route
                path="createUser"
                element={
                  <PrivateRoute roles={["admin"]}>
                    <CreateUser />
                  </PrivateRoute>
                }
              />
              <Route
                path="view/donations"
                element={
                  <PrivateRoute roles={["admin", "user"]}>
                    <ViewDonations />
                  </PrivateRoute>
                }
              />
              {/* Fallback: any unmatched protected route → /dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Route>

            {/* ─── Fallback (Public) ───────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
};

export default App;
