import { CategoriesManager } from "./categories-manager";

export const metadata = { title: "Categories & Tags — Forumo Admin" };

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Categories & Tags</h2>
        <p className="text-sm text-slate-400">
          Manage listing categories and tags
        </p>
      </div>
      <CategoriesManager />
    </div>
  );
}
