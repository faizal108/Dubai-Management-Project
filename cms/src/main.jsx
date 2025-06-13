import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider } from "@material-tailwind/react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Provider } from "react-redux";

const root = ReactDOM.createRoot(document.getElementById("root"));

const providers = (
    <ThemeProvider>
        <App />
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
      />
    </ThemeProvider>
);

if (import.meta.env.DEV) {
  root.render(providers);
} else {
  root.render(<React.StrictMode>{providers}</React.StrictMode>);
}
