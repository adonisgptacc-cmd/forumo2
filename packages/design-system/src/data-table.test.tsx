import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type TableColumn } from "./data-table";

type Item = { id: string; name: string; value: number };

const columns: TableColumn<Item>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "value", header: "Value" },
];

describe("DataTable", () => {
  it("renders empty state by default", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No records")).toBeInTheDocument();
  });

  it("renders custom emptyState", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<span>Empty custom</span>}
      />,
    );
    expect(screen.getByText("Empty custom")).toBeInTheDocument();
  });

  it("renders table with headers and data", () => {
    const data: Item[] = [
      { id: "1", name: "Alpha", value: 10 },
      { id: "2", name: "Beta", value: 20 },
    ];
    render(<DataTable columns={columns} data={data} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders single row", () => {
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Solo", value: 99 }]}
      />,
    );
    expect(screen.getByText("Solo")).toBeInTheDocument();
  });

  it("uses render prop when provided", () => {
    const colsWithRender: TableColumn<Item>[] = [
      {
        key: "name",
        header: "Name",
        render: (item) => <strong>{item.name.toUpperCase()}</strong>,
      },
      { key: "value", header: "Value" },
    ];
    render(
      <DataTable
        columns={colsWithRender}
        data={[{ id: "1", name: "gamma", value: 5 }]}
      />,
    );
    expect(screen.getByText("GAMMA")).toBeInTheDocument();
  });

  it("applies column className", () => {
    const cols: TableColumn<Item>[] = [
      { key: "name", header: "Name", className: "custom-col" },
    ];
    render(
      <DataTable
        columns={cols}
        data={[{ id: "1", name: "Delta", value: 1 }]}
      />,
    );
    expect(screen.getByText("Name").className).toContain("custom-col");
  });
});
