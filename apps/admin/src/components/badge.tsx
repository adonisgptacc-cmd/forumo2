import { clsx } from "clsx";

const colorMap: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  PUBLISHED: "bg-green-100 text-green-800",
  RESOLVED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
  FLAGGED: "bg-orange-100 text-orange-800",
  OPEN: "bg-orange-100 text-orange-800",
  UNDER_REVIEW: "bg-orange-100 text-orange-800",
  BANNED: "bg-red-100 text-red-800",
  REJECTED: "bg-red-100 text-red-800",
  DELETED: "bg-gray-100 text-gray-600",
  ADMIN: "bg-purple-100 text-purple-800",
  MODERATOR: "bg-blue-100 text-blue-800",
  SELLER: "bg-indigo-100 text-indigo-800",
  BUYER: "bg-gray-100 text-gray-700",
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorMap[value] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {value}
    </span>
  );
}
