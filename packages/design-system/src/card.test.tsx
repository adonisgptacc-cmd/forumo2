import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Hello world</Card>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <Card className="custom-card" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("custom-card");
    expect(screen.getByTestId("card")).toHaveClass("rounded-lg");
  });

  it("forwards html attributes", () => {
    render(
      <Card id="my-card" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("id", "my-card");
  });

  it("renders nested content", () => {
    render(
      <Card>
        <h2>Order #1234</h2>
        <p>Details</p>
      </Card>,
    );
    expect(screen.getByText("Order #1234")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
