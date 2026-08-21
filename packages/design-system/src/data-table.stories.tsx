import type { Meta, StoryObj } from "@storybook/react";
import { DataTable, type TableColumn } from "./data-table";

interface Product {
  id: number;
  name: string;
  price: string;
  status: string;
}

const columns: TableColumn<Product>[] = [
  { key: "name", header: "Product" },
  { key: "price", header: "Price" },
  {
    key: "status",
    header: "Status",
    render: (item) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          item.status === "Active"
            ? "bg-green-500/20 text-green-400"
            : "bg-slate-700 text-slate-300"
        }`}
      >
        {item.status}
      </span>
    ),
  },
];

const sampleData: Product[] = [
  { id: 1, name: "Vintage Camera", price: "R 1 200", status: "Active" },
  { id: 2, name: "Leather Jacket", price: "R 850", status: "Sold" },
  { id: 3, name: "Mechanical Keyboard", price: "R 2 400", status: "Active" },
  { id: 4, name: "Vinyl Record Player", price: "R 3 100", status: "Sold" },
];

const meta: Meta = {
  title: "Components/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: {
    backgrounds: { default: "dark" },
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DataTable columns={columns} data={sampleData} />,
};

export const Empty: Story = {
  render: () => <DataTable columns={columns} data={[]} />,
};

export const CustomEmptyState: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={[]}
      emptyState={
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="text-3xl">📦</span>
          <p className="text-sm text-slate-300">No listings yet</p>
          <p className="text-xs text-slate-500">
            Add a listing to get started.
          </p>
        </div>
      }
    />
  ),
};

export const SingleRow: Story = {
  render: () => <DataTable columns={columns} data={[sampleData[0]]} />,
};
