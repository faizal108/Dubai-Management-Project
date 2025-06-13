// handleResponse.js
import { toast } from "react-toastify"; 

// Utility to safely extract API response
export const handleApiResponse = (promise, options = {}) => {
  const {
    showSuccess = false,
    successMessage = "Operation successful.",
    showError = true,
    errorMessage = "Something went wrong.",
    transform = (data) => data, // Optionally shape the response
  } = options;

  return promise
    .then((response) => {
      if (showSuccess) {
        toast.success(successMessage);
      }
      return transform(response.data);
    })
    .catch((error) => {
      const extracted = extractError(error);
      if (showError) {
        toast.error(extracted.message || errorMessage);
      }
      return Promise.reject(extracted); // Pass to caller if needed
    });
};

// Extract detailed error info
export const extractError = (error) => {
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;

    return {
      status,
      message: data?.message || data?.error || "API error occurred",
      data,
    };
  }

  if (error?.request) {
    return {
      message: "No response from server. Please check your connection.",
    };
  }

  return {
    message: error?.message || "Unexpected error",
  };
};
