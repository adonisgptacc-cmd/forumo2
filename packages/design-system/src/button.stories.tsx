import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Click me",
    onClick: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { isLoading: true, children: "Saving…" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
