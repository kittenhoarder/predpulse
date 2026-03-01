import { describe, it, expect } from "vitest";
import { formatCurrency, formatChange } from "../format";

describe("formatCurrency", () => {
  it("formats millions", () => {
    expect(formatCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCurrency(1_000_000)).toBe("$1.0M");
  });

  it("formats thousands", () => {
    expect(formatCurrency(50_000)).toBe("$50K");
    expect(formatCurrency(1_000)).toBe("$1K");
  });

  it("formats sub-thousand values", () => {
    expect(formatCurrency(500)).toBe("$500");
    expect(formatCurrency(0)).toBe("$0");
  });
});

describe("formatChange", () => {
  it("adds + sign for positive values", () => {
    expect(formatChange(5.3)).toBe("+5.3%");
  });

  it("shows - sign for negative values", () => {
    expect(formatChange(-2.1)).toBe("-2.1%");
  });

  it("shows no sign for zero", () => {
    expect(formatChange(0)).toBe("0.0%");
  });
});
