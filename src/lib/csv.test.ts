import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes separators and adds BOM", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], [1, null]])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n1,');
  });

  it("neutralises formula injection but keeps negative numbers", () => {
    expect(toCsv(["v"], [["=HYPERLINK(1)"], ["-250000"], ["+62812"]])).toBe("﻿v\r\n'=HYPERLINK(1)\r\n-250000\r\n'+62812");
  });
});
