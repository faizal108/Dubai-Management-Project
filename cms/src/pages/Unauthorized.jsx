import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md text-center">
        <div className="text-red-500 text-6xl mb-4">⛔</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-4">
          You don’t have permission to view this page.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          If you believe this is a mistake, please contact your administrator.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 transition"
        >
          ⬅ Go Back
        </button>
      </div>
    </div>
  );
}
