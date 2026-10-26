import { parseVirtualWorldNumber } from "./virtual-world-numbers";

describe("virtual-world wire numbers", () => {
  it("reads numeric JSON and English and German decimals without losing precision", () => {
    for (const value of [123.45, "123.45", "123,45", " 123,45 "]) {
      expect(parseVirtualWorldNumber(value)).toBe(123.45);
    }
    expect(parseVirtualWorldNumber(0)).toBe(0);
    expect(parseVirtualWorldNumber("0")).toBe(0);
    expect(parseVirtualWorldNumber("-224000,75")).toBe(-224000.75);
    expect(parseVirtualWorldNumber("1,25E-3")).toBe(0.00125);
  });

  it("rejects missing, non-finite and malformed values instead of producing a false angle", () => {
    const invalid = [null, undefined, "", " ", NaN, Infinity, -Infinity,
      "NaN", "infinite", "1.234,56", "1,2,3", "12deg", "0x10", true, {}];
    for (const value of invalid) {
      expect(parseVirtualWorldNumber(value)).toBeNull();
    }
  });
});
