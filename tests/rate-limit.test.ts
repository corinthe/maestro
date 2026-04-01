import { describe, it, expect } from "vitest";
import { canSpawnAgent } from "@/lib/rate-limit";

describe("canSpawnAgent", () => {
  it("allows spawn when below limit", () => {
    expect(canSpawnAgent(0)).toBe(true);
    expect(canSpawnAgent(4)).toBe(true);
  });

  it("blocks spawn when at limit", () => {
    expect(canSpawnAgent(5)).toBe(false);
    expect(canSpawnAgent(10)).toBe(false);
  });
});
