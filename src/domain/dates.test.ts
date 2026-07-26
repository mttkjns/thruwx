import { describe, expect, it } from "vitest";
import { addDays, dayOfYearIndex, formatIsoDate, parseIsoDate } from "./dates";

describe("parseIsoDate / formatIsoDate", () => {
  it("round-trips and stays in UTC", () => {
    expect(formatIsoDate(parseIsoDate("2026-03-15"))).toBe("2026-03-15");
    expect(parseIsoDate("2026-03-15").getUTCHours()).toBe(0);
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays("2026-03-01", 14)).toBe("2026-03-15");
  });
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("crosses Feb 29 in a leap year", () => {
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(addDays("2023-02-28", 2)).toBe("2023-03-02");
  });
  it("handles zero and negative offsets", () => {
    expect(addDays("2026-03-15", 0)).toBe("2026-03-15");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayOfYearIndex (leap layout, 0-based)", () => {
  it("anchors: Jan 1 = 0, Dec 31 = 365", () => {
    expect(dayOfYearIndex("2026-01-01")).toBe(0);
    expect(dayOfYearIndex("2026-12-31")).toBe(365);
    expect(dayOfYearIndex("2024-12-31")).toBe(365);
  });
  it("Feb 29 = 59 in leap years", () => {
    expect(dayOfYearIndex("2024-02-29")).toBe(59);
  });
  it("Mar 1 = 60 in BOTH leap and non-leap years (the invariant)", () => {
    expect(dayOfYearIndex("2024-03-01")).toBe(60);
    expect(dayOfYearIndex("2023-03-01")).toBe(60);
  });
  it("agrees for a mid-summer date regardless of year", () => {
    expect(dayOfYearIndex("2024-07-15")).toBe(196);
    expect(dayOfYearIndex("2023-07-15")).toBe(196);
  });
});
