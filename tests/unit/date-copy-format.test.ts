import { describe, expect, it } from "vitest";

import { formatCount, formatDateRange, formatWeekRange } from "@/lib/utils";

describe("Spanish date and copy helpers", () => {
  it("formats same-month date ranges without the old week prefix", () => {
    expect(
      formatDateRange(
        new Date("2026-06-15T12:00:00.000Z"),
        new Date("2026-06-21T12:00:00.000Z")
      )
    ).toBe("Del 15 al 21 de junio de 2026");
  });

  it("formats ranges that cross months or years", () => {
    expect(
      formatDateRange(
        new Date("2026-06-29T12:00:00.000Z"),
        new Date("2026-07-05T12:00:00.000Z")
      )
    ).toBe("Del 29 de junio al 5 de julio de 2026");

    expect(
      formatDateRange(
        new Date("2026-12-28T12:00:00.000Z"),
        new Date("2027-01-03T12:00:00.000Z")
      )
    ).toBe("Del 28 de diciembre de 2026 al 3 de enero de 2027");
  });

  it("normalizes week ranges from Monday to Sunday", () => {
    expect(formatWeekRange(new Date("2026-06-18T12:00:00.000Z"))).toBe(
      "Del 15 al 21 de junio de 2026"
    );
  });

  it("pluralizes common Spanish counters", () => {
    expect(formatCount(1, "pareja")).toBe("1 pareja");
    expect(formatCount(2, "pareja")).toBe("2 parejas");
    expect(formatCount(1, "día", "días")).toBe("1 día");
    expect(formatCount(3, "día", "días")).toBe("3 días");
    expect(formatCount(1, "turno sin cobertura", "turnos sin cobertura")).toBe(
      "1 turno sin cobertura"
    );
    expect(formatCount(4, "turno sin cobertura", "turnos sin cobertura")).toBe(
      "4 turnos sin cobertura"
    );
  });
});
