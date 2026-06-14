// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FaqAccordions } from "./faq-accordions";
import { faqs } from "./landing-data";

afterEach(cleanup);

describe("FaqAccordions", () => {
  it("renders every FAQ closed by default", () => {
    render(<FaqAccordions />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(faqs.length);
    for (const b of buttons) {
      expect(b).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens an item on click and closes it again on a second click", () => {
    render(<FaqAccordions />);
    const first = screen.getByRole("button", { name: /Is the accounting actually correct/ });

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles items independently (more than one can be open at once)", () => {
    render(<FaqAccordions />);
    const first = screen.getByRole("button", { name: /Is the accounting actually correct/ });
    const second = screen.getByRole("button", { name: /Will I just have to redo it in Tally/ });

    fireEvent.click(first);
    fireEvent.click(second);

    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");
  });
});
