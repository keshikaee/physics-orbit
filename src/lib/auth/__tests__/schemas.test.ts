import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "../schemas";

const valid = { firstName: "Alice", lastName: "Smith", email: "alice@example.com", password: "orbit1234" };

describe("registerSchema", () => {
  it("accepts a valid registration and normalises email", () => {
    const r = registerSchema.safeParse({ ...valid, email: "  Alice@Example.COM " });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("alice@example.com");
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it.each([
    ["short", "ab1"],
    ["no number", "onlyletters"],
    ["no letter", "12345678"],
    ["too long", "a1".repeat(40)],
  ])("rejects a weak password (%s)", (_label, password) => {
    expect(registerSchema.safeParse({ ...valid, password }).success).toBe(false);
  });

  it("requires names", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "   " }).success).toBe(false);
  });

  it("strips unknown fields such as a client-supplied role", () => {
    const r = registerSchema.safeParse({ ...valid, role: "teacher" });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("role");
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = resetPasswordSchema.safeParse({ password: "orbit1234", confirmPassword: "orbit12345" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
