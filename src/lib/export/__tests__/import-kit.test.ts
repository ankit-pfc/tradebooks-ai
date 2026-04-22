import { describe, expect, it } from "vitest";
import {
  buildTallyImportArtifactNames,
  TALLY_IMPORT_STEPS,
} from "../import-kit";

describe("buildTallyImportArtifactNames", () => {
  it("prefixes masters and transactions filenames with import order", () => {
    expect(
      buildTallyImportArtifactNames("Tradebooks Demo Pvt. Ltd.", "2024-04-01", "2025-03-31"),
    ).toEqual({
      mastersFilename: "01_Tradebooks_Demo_Pvt__Ltd__Ledger_Masters_FY2024-25.xml",
      transactionsFilename: "02_Tradebooks_Demo_Pvt__Ltd__Transactions_FY2024-25.xml",
    });
  });

  it("falls back to ordered generic names when company or FY is unavailable", () => {
    expect(buildTallyImportArtifactNames("", "", "")).toEqual({
      mastersFilename: "01_tally-masters.xml",
      transactionsFilename: "02_tally-transactions.xml",
    });
  });
});

describe("TALLY_IMPORT_STEPS", () => {
  it("documents masters import before transactions import", () => {
    expect(TALLY_IMPORT_STEPS).toHaveLength(3);
    expect(TALLY_IMPORT_STEPS[0].title).toContain("Masters");
    expect(TALLY_IMPORT_STEPS[1].title).toContain("Transactions");
    expect(TALLY_IMPORT_STEPS[2].detail).toContain("contract note number");
  });
});
