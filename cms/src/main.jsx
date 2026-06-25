import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Theme-aware toast container: follows light/dark mode automatically.
function ThemedToastContainer() {
  const { resolvedMode } = useTheme();
  return (
    <ToastContainer
      position="top-center"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick={true}
      rtl={false}
      pauseOnFocusLoss={true}
      draggable={true}
      pauseOnHover={true}
      theme={resolvedMode}
    />
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

const providers = (
  <ThemeProvider>
    <App />
    <ThemedToastContainer />
  </ThemeProvider>
);

if (import.meta.env.DEV) {
  root.render(providers);
} else {
  root.render(<React.StrictMode>{providers}</React.StrictMode>);
}
