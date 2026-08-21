import { InventoryManager } from "./inventory-manager";

export const metadata = { title: "Inventory — Forumo" };

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Inventory</h2>
        <p className="text-sm text-slate-400">
          Manage stock levels across your listings
        </p>
      </div>
      <InventoryManager />
    </div>
  );
}
