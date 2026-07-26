import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "./ids";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("newId", () => {
  it("produces v4 UUIDs", () => {
    expect(newId()).toMatch(UUID_RE);
  });

  it("produces v4 UUIDs without crypto.randomUUID (insecure context)", () => {
    // http:// on a LAN IP: randomUUID is absent, getRandomValues is not.
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    expect(typeof crypto.randomUUID).toBe("undefined");
    expect(newId()).toMatch(UUID_RE);
  });

  it("does not collide across many calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
  });
});
