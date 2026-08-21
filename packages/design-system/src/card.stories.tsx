import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="p-4">
      <p className="text-sm text-gray-600">Card content goes here.</p>
    </Card>
  ),
};

export const WithHeading: Story = {
  render: () => (
    <Card className="p-4">
      <h3 className="mb-1 text-base font-semibold text-gray-900">
        Order #1234
      </h3>
      <p className="mb-4 text-sm text-gray-500">Placed on 24 May 2026</p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm">
          Confirm
        </Button>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </div>
    </Card>
  ),
};

export const CustomPadding: Story = {
  render: () => (
    <Card className="p-8">
      <p className="text-sm text-gray-700">
        This card has extra padding applied via <code>className</code>.
      </p>
    </Card>
  ),
};

export const Nested: Story = {
  render: () => (
    <Card className="p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">Outer card</p>
      <Card className="p-3 bg-gray-50">
        <p className="text-sm text-gray-600">Inner card</p>
      </Card>
    </Card>
  ),
};
