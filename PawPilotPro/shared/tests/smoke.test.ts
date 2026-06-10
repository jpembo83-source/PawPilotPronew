import { describe, it, expect } from "vitest";
import * as shared from "../types";

describe("shared package", () => {
  it("exports a namespace", () => {
    expect(typeof shared).toBe("object");
  });
});
