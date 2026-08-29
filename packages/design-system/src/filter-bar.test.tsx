import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterBar } from "./filter-bar";

describe("FilterBar", () => {
  it("renders without props", () => {
    const { container } = render(<FilterBar />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<FilterBar title="Filters" />);
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("renders chips and handles click and active state", () => {
    const onClick = vi.fn();
    render(
      <FilterBar
        chips={[
          { key: "all", label: "All", active: true, onClick },
          { key: "active", label: "Active" },
        ]}
      />,
    );
    const allBtn = screen.getByRole("button", { name: "All" });
    const activeBtn = screen.getByRole("button", { name: "Active" });
    expect(allBtn).toBeInTheDocument();
    expect(activeBtn).toBeInTheDocument();
    expect(allBtn.className).toContain("border-amber-400");
    expect(activeBtn.className).toContain("border-slate-700");
    allBtn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders children content", () => {
    render(
      <FilterBar>
        <input aria-label="search" placeholder="Search..." />
      </FilterBar>,
    );
    expect(screen.getByLabelText("search")).toBeInTheDocument();
  });

  it("renders actions", () => {
    render(<FilterBar actions={<button>Apply</button>} />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("renders title, chips, children and actions together", () => {
    render(
      <FilterBar
        title="Browse"
        chips={[{ key: "1", label: "Chip1" }]}
        actions={<button>Go</button>}
      >
        <span>Extra</span>
      </FilterBar>,
    );
    expect(screen.getByText("Browse")).toBeInTheDocument();
    expect(screen.getByText("Chip1")).toBeInTheDocument();
    expect(screen.getByText("Extra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});
