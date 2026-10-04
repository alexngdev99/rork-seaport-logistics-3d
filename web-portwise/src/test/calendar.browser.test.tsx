import { render } from "vitest-browser-react";

import { Calendar } from "@/components/ui/calendar";

test("renders a month grid with navigation controls", async () => {
  // Fix the month so the calendar grid remains deterministic across test runs.
  const screen = await render(<Calendar mode="single" defaultMonth={new Date(2026, 0, 1)} />);

  await expect.element(screen.getByRole("grid")).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  expect(screen.getByRole("gridcell").all().length).toBeGreaterThan(27);
});
