import { describe, expect, it } from "vitest";
import { CURRICULA, DISTRICTS, ageOn, formatPhone, normalizePhone, studentDetailsSchema } from "../profile";
import { registrationSchema } from "@/lib/auth/schemas";

describe("normalizePhone", () => {
  it.each([
    ["077 123 4567", "+94771234567"],
    ["0771234567", "+94771234567"],
    ["771234567", "+94771234567"],
    ["94771234567", "+94771234567"],
    ["+94 77 123 4567", "+94771234567"],
    ["+94 077 123 4567", "+94771234567"],
    ["0094-77-123-4567", "+94771234567"],
    ["011 234 5678", "+94112345678"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizePhone(raw)).toBe(e164);
  });

  it.each(["", "12345", "077123456", "07712345678", "+94 12345", "abc", "+0123456789"])("rejects %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  it("formats Sri Lankan numbers for display", () => {
    expect(formatPhone("+94771234567")).toBe("+94 77 123 4567");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("ageOn", () => {
  it("counts whole years, before and after the birthday", () => {
    expect(ageOn("2008-05-14", new Date("2026-05-13T12:00:00Z"))).toBe(17);
    expect(ageOn("2008-05-14", new Date("2026-05-14T12:00:00Z"))).toBe(18);
  });
});

describe("reference lists", () => {
  it("has the four curricula and 25 districts", () => {
    expect(CURRICULA.map((c) => c.slug)).toEqual(["edexcel", "cambridge", "local", "other"]);
    expect(DISTRICTS).toHaveLength(25);
    expect(new Set(DISTRICTS.map(([s]) => s)).size).toBe(25);
  });
});

describe("student details validation", () => {
  const ok = {
    curriculum: "cambridge",
    institute: "Royal College, Colombo",
    district: "colombo",
    dateOfBirth: "2008-05-14",
    gender: "",
    phone: "077 123 4567",
    whatsapp: "on",
    consent: "on",
  };

  it("accepts a valid form, normalising the phone and making gender optional", () => {
    const r = studentDetailsSchema.parse(ok);
    expect(r).toMatchObject({ curriculum: "cambridge", phone: "+94771234567", whatsapp: true, gender: null });
  });

  it.each([
    ["curriculum", { curriculum: "ib" }],
    ["district", { district: "atlantis" }],
    ["institute", { institute: " " }],
    ["dateOfBirth", { dateOfBirth: "2024-01-01" }],
    ["dateOfBirth", { dateOfBirth: "14/05/2008" }],
    ["phone", { phone: "12345" }],
    ["consent", { consent: "" }],
  ])("rejects a bad %s", (field, patch) => {
    const r = studentDetailsSchema.safeParse({ ...ok, ...patch });
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path[0] === field)).toBe(true);
  });

  it("registration needs the account fields too", () => {
    const r = registrationSchema.safeParse({ ...ok, firstName: "Asha", lastName: "Perera", email: "k@example.com", password: "abcdefg1" });
    expect(r.success).toBe(true);
    expect(registrationSchema.safeParse(ok).success).toBe(false);
  });
});
