import React from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  CurrencyRupeeIcon,
  UsersIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend
);

const formatValue = (value) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)} M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)} K`;
  }
  return value.toString();
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className={`rounded-2xl shadow-md text-white ${color} h-full flex p-6`}>
    <div className="flex flex-col justify-center items-start space-y-2">
      <Icon className="h-12 w-12" /> 
      <span className="text-lg font-semibold">{title}</span>{" "}
    </div>

    <div className="ml-auto flex items-center">
      <span className="text-5xl font-bold">{formatValue(value)}</span>{" "}
    </div>
  </div>
);

const DashboardSection = ({ title, children }) => (
  <div className="bg-white p-6 rounded-2xl shadow-md h-full flex flex-col">
    <h3 className="text-xl font-semibold mb-4 text-gray-700">{title}</h3>{" "}
    <div className="flex-1 overflow-auto">{children}</div>{" "}
  </div>
);

const donationTrendData = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  datasets: [
    {
      label: "Donations",
      data: [5000, 8000, 7500, 11000, 9000, 12500],
      fill: false,
      borderColor: "#3b82f6",
      tension: 0.3,
    },
    {
      label: "Donors",
      data: [8000, 5000, 10000, 5000, 7500, 11000],
      fill: false,
      borderColor: "#f59e0b",
      tension: 0.3,
    },
  ],
};

const donationTypeData = {
  labels: ["Cash", "Cheque", "Online"],
  datasets: [
    {
      data: [45, 25, 30],
      backgroundColor: ["#10b981", "#f59e0b", "#3b82f6"],
      hoverOffset: 4,
    },
  ],
};

const stats = [
  {
    title: "Total Donations",
    value: 1250000,
    icon: CurrencyRupeeIcon,
    color: "bg-blue-500",
  },
  {
    title: "Total Donors",
    value: 3250,
    icon: UsersIcon,
    color: "bg-green-500",
  },
  {
    title: "Recurring Donations",
    value: 450,
    icon: ArrowPathIcon,
    color: "bg-purple-500",
  },
];

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <DashboardSection title="Donation Trends (Monthly)">
          <div className="h-64 md:h-80">
            <Line
              data={donationTrendData}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </DashboardSection>

        <DashboardSection title="Donation Types Distribution">
          <div className="h-64 md:h-80">
            <Pie
              data={donationTypeData}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <DashboardSection title="Recent Donations">
          <ul className="text-base text-gray-600 space-y-2">
            <li>John Doe donated ₹5,000</li>
            <li>Jane Smith donated ₹3,500</li>
            <li>Akash Mehta donated ₹7,000</li>
          </ul>
        </DashboardSection>

        <DashboardSection title="Top Donors">
          <ol className="text-base text-gray-600 space-y-2">
            <li>1. Arjun Reddy – ₹25,000</li>
            <li>2. Nisha Patel – ₹18,500</li>
            <li>3. Rohit Sharma – ₹15,000</li>
          </ol>
        </DashboardSection>
      </div>
    </div>
  );
};

export default Dashboard;
