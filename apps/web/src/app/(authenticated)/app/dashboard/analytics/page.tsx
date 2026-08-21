import type { Metadata } from "next";
import { AnalyticsDashboard } from "./analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics | Forumo",
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
