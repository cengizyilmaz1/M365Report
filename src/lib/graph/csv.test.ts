import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("supports quoted commas and embedded quotes", () => {
    const rows = parseCsv('Name,Note\n"Contoso, Inc.","Said ""hello"""');

    expect(rows).toEqual([
      {
        Name: "Contoso, Inc.",
        Note: 'Said "hello"'
      }
    ]);
  });
});
