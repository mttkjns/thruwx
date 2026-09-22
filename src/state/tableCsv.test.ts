import { describe, expect, it } from "vitest";
import { tableCsvFileName, tableToCsv } from "./tableCsv";

describe("tableToCsv", () => {
  it("writes a header and rounded rows with CRLF line endings", () => {
    const csv = tableToCsv([
      { name: "Springer Mountain", trailMile: 0, date: "2027-03-01", lowF: 28.6, highF: 51.2, wetPct: 33.4, daylightH: 11.54 },
    ]);
    expect(csv).toBe(
      "Waypoint,Mile,Date,Low °F,High °F,Wet %,Daylight (h)\r\n" +
        "Springer Mountain,0.0,2027-03-01,29,51,33,11.5\r\n",
    );
  });

  it("leaves missing weather empty", () => {
    const csv = tableToCsv([
      { name: "X", trailMile: 31.7, date: "2027-03-02", lowF: null, highF: null, wetPct: null, daylightH: 12 },
    ]);
    expect(csv.split("\r\n")[1]).toBe("X,31.7,2027-03-02,,,,12.0");
  });

  it("quotes names containing commas or quotes", () => {
    const csv = tableToCsv([
      { name: 'Hot Springs, NC "HS"', trailMile: 274.9, date: "2027-04-01", lowF: 40, highF: 60, wetPct: 30, daylightH: 12.8 },
    ]);
    expect(csv.split("\r\n")[1]).toBe('"Hot Springs, NC ""HS""",274.9,2027-04-01,40,60,30,12.8');
  });
});

describe("tableCsvFileName", () => {
  it("is StartDate-EndDate-Direction.csv", () => {
    expect(tableCsvFileName("2027-03-01", "2027-08-20", "NOBO")).toBe("20270301-20270820-NOBO.csv");
    expect(tableCsvFileName("2027-06-15", "2027-12-01", "SOBO")).toBe("20270615-20271201-SOBO.csv");
  });
});
