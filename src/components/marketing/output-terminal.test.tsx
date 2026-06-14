// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OutputTerminal } from "./output-terminal";

afterEach(cleanup);

describe("OutputTerminal source trace", () => {
  it("traces the first voucher (INFY → Equity Sales, LTCG) by default", () => {
    render(<OutputTerminal />);
    expect(screen.getByTestId("trace-vch")).toHaveTextContent("Sales · 31 Mar 25");
    expect(screen.getByTestId("trace-amt")).toHaveTextContent("₹2,21,052.00");
    expect(screen.getByTestId("trace-body")).toHaveTextContent("INFY");
  });

  it("updates the trace panel when a different voucher row is clicked", () => {
    render(<OutputTerminal />);

    // Click the TCS purchase row.
    fireEvent.click(screen.getByText(/Equity Purchases — investments/));

    expect(screen.getByTestId("trace-vch")).toHaveTextContent("Purchase · 28 Mar 25");
    expect(screen.getByTestId("trace-amt")).toHaveTextContent("₹6,15,000.00");
    expect(screen.getByTestId("trace-body")).toHaveTextContent("TCS");
    // Previously-shown symbol is gone.
    expect(screen.getByTestId("trace-body")).not.toHaveTextContent("INFY");
  });

  it("marks the selected row as pressed and moves it on click", () => {
    render(<OutputTerminal />);
    const pressed = () =>
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");

    expect(pressed()).toHaveLength(1); // exactly one selected at a time

    fireEvent.click(screen.getByText(/Suspense — contract note mismatch/));
    expect(pressed()).toHaveLength(1);
    expect(screen.getByTestId("trace-vch")).toHaveTextContent("Receipt · 26 Mar 25");
  });
});
