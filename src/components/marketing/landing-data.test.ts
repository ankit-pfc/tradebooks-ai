import { describe, it, expect } from "vitest";
import {
  inr,
  vouchers,
  comparisonRows,
  comparisonColumns,
  faqs,
  pricingFree,
  pricingPro,
  steps,
} from "./landing-data";

describe("inr()", () => {
  it("formats positive amounts with en-IN (lakh) grouping and 2 decimals", () => {
    expect(inr(221052)).toBe("₹2,21,052.00");
    expect(inr(3315.69)).toBe("₹3,315.69");
    expect(inr(0)).toBe("₹0.00");
  });

  it("prefixes negatives with a real Unicode minus (U+2212), not an ASCII hyphen", () => {
    expect(inr(-18420.5)).toBe("₹−18,420.50");
    expect(inr(-615000)).toContain("−");
    expect(inr(-615000)).not.toContain("-"); // no ASCII hyphen
  });

  it("always shows exactly two fraction digits", () => {
    expect(inr(5)).toBe("₹5.00");
    expect(inr(1234.5)).toBe("₹1,234.50");
  });
});

describe("voucher data", () => {
  it("has five vouchers, each with the fields the terminal + trace panel render", () => {
    expect(vouchers).toHaveLength(5);
    for (const v of vouchers) {
      expect(v.id).toBeTruthy();
      expect(v.src.symbol).toBeDefined();
      expect(v.resolve.ledger).toBeTruthy();
      expect(v.resolve.amt).toMatch(/^₹/);
      expect(["ok", "warn"]).toContain(v.st);
    }
  });

  it("has exactly one exception (warn) row — the contract-note mismatch", () => {
    const warns = vouchers.filter((v) => v.st === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0].id).toBe("v5");
    expect(warns[0].resolve.ledger).toBe("Suspense");
  });
});

describe("comparison matrix", () => {
  it("has four columns with TradeBooks AI last", () => {
    expect(comparisonColumns).toHaveLength(4);
    expect(comparisonColumns[3]).toBe("TradeBooks AI");
  });

  it("is a 7×4 grid where the TradeBooks AI column is always a yes", () => {
    expect(comparisonRows).toHaveLength(7);
    for (const row of comparisonRows) {
      expect(row).toHaveLength(4);
      expect(row[3]).toBe("yes");
    }
  });
});

describe("pricing + content", () => {
  it("exposes the four how-it-works steps in order", () => {
    expect(steps.map((s) => s.n)).toEqual(["01", "02", "03", "04"]);
    expect(steps[1].title).toBe("AI maps every line");
  });

  it("keeps the Pro plan a superset of Free", () => {
    expect(pricingPro.features).toContain("Everything in Free");
    expect(pricingFree.features.length).toBeGreaterThan(0);
    expect(pricingPro.price).toBe("₹2,999");
  });

  it("has six non-empty FAQ entries (the single source for the FAQ JSON-LD)", () => {
    expect(faqs).toHaveLength(6);
    for (const f of faqs) {
      expect(f.q.length).toBeGreaterThan(0);
      expect(f.a.length).toBeGreaterThan(0);
    }
  });
});
