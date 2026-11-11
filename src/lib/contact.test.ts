import { describe, expect, it } from "vitest";
import { contactDisplay, formatPhone } from "~/lib/contact";

describe("contact formatting", () => {
  it("formats US numbers and leaves others as stored", () => {
    expect(formatPhone("+14155550142")).toBe("(415) 555-0142");
    expect(formatPhone("+447911123456")).toBe("+447911123456");
  });

  it("builds display text per method", () => {
    const phone = { method: "phone", value: "+14155550142" } as const;
    const ig = { method: "instagram", value: "alexr.poker" } as const;
    const email = { method: "email", value: "a@b.co" } as const;

    expect(contactDisplay(phone)).toBe("(415) 555-0142");
    expect(contactDisplay(ig)).toBe("@alexr.poker");
    expect(contactDisplay(email)).toBe("a@b.co");
  });
});
