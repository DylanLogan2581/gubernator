import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Bar, BarChart } from "recharts";

import { ChartContainer, type ChartConfig } from "./chart";

// recharts ResponsiveContainer uses ResizeObserver for layout; provide a stub
// so the component tree can render in jsdom without errors.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverStub;

const config = {
  value: { label: "Value", color: "#4f46e5" },
} satisfies ChartConfig;

describe("ChartContainer", () => {
  it("renders chart wrapper with data-slot attribute", () => {
    const { container } = render(
      <ChartContainer config={config}>
        <BarChart data={[{ value: 10 }]}>
          <Bar dataKey="value" />
        </BarChart>
      </ChartContainer>,
    );

    expect(container.querySelector('[data-slot="chart"]')).toBeDefined();
  });
});
