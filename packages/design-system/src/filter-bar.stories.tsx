import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FilterBar, type FilterChip } from "./filter-bar";
import { Button } from "./button";

const meta: Meta<typeof FilterBar> = {
  title: "Components/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  parameters: {
    backgrounds: { default: "dark" },
  },
};
export default meta;

type Story = StoryObj<typeof FilterBar>;

const staticChips: FilterChip[] = [
  { key: "all", label: "All", active: true },
  { key: "active", label: "Active" },
  { key: "sold", label: "Sold" },
  { key: "draft", label: "Draft" },
];

export const Default: Story = {};

export const WithTitle: Story = {
  args: { title: "My Listings" },
};

export const WithChips: Story = {
  args: {
    title: "Filter by status",
    chips: staticChips,
  },
};

export const WithActions: Story = {
  args: {
    title: "Orders",
    chips: staticChips,
    actions: (
      <Button size="sm" variant="primary">
        + New Listing
      </Button>
    ),
  },
};

export const Interactive: Story = {
  render: () => {
    const keys = ["all", "active", "sold", "draft"] as const;
    const [active, setActive] = useState<string>("all");
    const chips: FilterChip[] = keys.map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      active: active === key,
      onClick: () => setActive(key),
    }));
    return (
      <FilterBar
        title="Listings"
        chips={chips}
        actions={
          <Button size="sm" variant="outline">
            Export CSV
          </Button>
        }
      />
    );
  },
};

export const WithChildren: Story = {
  render: () => (
    <FilterBar title="Search results">
      <input
        type="search"
        placeholder="Filter by name…"
        className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    </FilterBar>
  ),
};

export const Full: Story = {
  render: () => {
    const [active, setActive] = useState<string>("all");
    const chips: FilterChip[] = ["all", "active", "sold", "draft"].map(
      (key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        active: active === key,
        onClick: () => setActive(key),
      }),
    );
    return (
      <FilterBar
        title="Listings"
        chips={chips}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Export
            </Button>
            <Button size="sm" variant="primary">
              + Add
            </Button>
          </div>
        }
      >
        <input
          type="search"
          placeholder="Search…"
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </FilterBar>
    );
  },
};
