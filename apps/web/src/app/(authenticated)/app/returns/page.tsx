import { ReturnsBoard } from "./returns-board";

export const metadata = { title: "Returns — Forumo" };

export default function ReturnsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Returns</h2>
        <p className="text-sm text-slate-400">
          Track the status of your return requests
        </p>
      </div>
      <ReturnsBoard />
    </div>
  );
}
