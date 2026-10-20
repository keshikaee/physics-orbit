import { z } from "zod";

/*
 * Curriculum and student-detail rules shared by registration, profile
 * completion, the admin screens and tests. The database re-validates every
 * value (CHECK constraints + handle_new_user / guard_profile_update).
 */

/** Stable identifiers — the database rows use the same slugs. */
export const CURRICULA = [
  { slug: "edexcel", name: "Edexcel", hint: "Pearson Edexcel International AS Physics" },
  { slug: "cambridge", name: "Cambridge", hint: "Cambridge International Physics" },
  { slug: "local", name: "Local", hint: "Sri Lankan G.C.E. Advanced Level Physics" },
  { slug: "other", name: "Other", hint: "Other curricula" },
] as const;
export type CurriculumSlug = (typeof CURRICULA)[number]["slug"];
export const CURRICULUM_SLUGS = CURRICULA.map((c) => c.slug) as [CurriculumSlug, ...CurriculumSlug[]];

/** The 25 districts of Sri Lanka. */
export const DISTRICTS = [
  ["ampara", "Ampara"],
  ["anuradhapura", "Anuradhapura"],
  ["badulla", "Badulla"],
  ["batticaloa", "Batticaloa"],
  ["colombo", "Colombo"],
  ["galle", "Galle"],
  ["gampaha", "Gampaha"],
  ["hambantota", "Hambantota"],
  ["jaffna", "Jaffna"],
  ["kalutara", "Kalutara"],
  ["kandy", "Kandy"],
  ["kegalle", "Kegalle"],
  ["kilinochchi", "Kilinochchi"],
  ["kurunegala", "Kurunegala"],
  ["mannar", "Mannar"],
  ["matale", "Matale"],
  ["matara", "Matara"],
  ["monaragala", "Monaragala"],
  ["mullaitivu", "Mullaitivu"],
  ["nuwara-eliya", "Nuwara Eliya"],
  ["polonnaruwa", "Polonnaruwa"],
  ["puttalam", "Puttalam"],
  ["ratnapura", "Ratnapura"],
  ["trincomalee", "Trincomalee"],
  ["vavuniya", "Vavuniya"],
] as const;
export type DistrictSlug = (typeof DISTRICTS)[number][0];
const DISTRICT_SLUGS = DISTRICTS.map(([s]) => s) as [DistrictSlug, ...DistrictSlug[]];
export const districtName = (slug: string | null | undefined) => DISTRICTS.find(([s]) => s === slug)?.[1] ?? null;

export const GENDERS = [
  ["male", "Male"],
  ["female", "Female"],
  ["other", "Other"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;
export const genderName = (slug: string | null | undefined) => GENDERS.find(([s]) => s === slug)?.[1] ?? null;

/**
 * Normalise a phone number to E.164. Sri Lankan numbers may be typed as
 * 077 123 4567, 771234567, 94771234567, 0094 77 123 4567 or +94 77 123 4567
 * (mobiles and landlines). Other countries need a leading +.
 * Returns null when the number can't be valid.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 30) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^\+94/.test(s) || /^94\d{9}$/.test(s)) {
    const national = s.replace(/^\+?94/, "").replace(/^0/, "");
    return /^[1-9]\d{8}$/.test(national) ? `+94${national}` : null;
  }
  if (s.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  if (/^0[1-9]\d{8}$/.test(s)) return `+94${s.slice(1)}`;
  if (/^7\d{8}$/.test(s)) return `+94${s}`;
  return null;
}

/** +94771234567 → +94 77 123 4567 (other numbers unchanged). */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return null;
  const m = e164.match(/^\+94(\d{2})(\d{3})(\d{4})$/);
  return m ? `+94 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Whole years between a date of birth and today (or `on`). */
export function ageOn(dateOfBirth: string, on = new Date()) {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export const MIN_AGE = 10;
export const MAX_AGE = 100;


const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Academic + personal details collected at registration (and profile completion). */
export const studentDetailsSchema = z.object({
  curriculum: z.enum(CURRICULUM_SLUGS, "Choose your curriculum."),
  institute: z.string().trim().min(2, "Enter your school, institute or exam centre.").max(200, "Use 200 characters or fewer."),
  district: z.enum(DISTRICT_SLUGS, "Choose your district."),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.")
    .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), "Enter a valid date.")
    .refine((d) => {
      const age = ageOn(d);
      return age >= MIN_AGE && age <= MAX_AGE;
    }, `You must be between ${MIN_AGE} and ${MAX_AGE} years old.`),
  gender: z
    .union([z.enum(["male", "female", "other", "prefer_not_to_say"]), z.literal("")])
    .optional()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a contact number.")
    .transform((v, ctx) => {
      const n = normalizePhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a valid number, e.g. 077 123 4567 or +94 77 123 4567." });
        return z.NEVER;
      }
      return n;
    }),
  whatsapp: checkbox,
  consent: z
    .string()
    .optional()
    .refine((v) => v === "on" || v === "true", "Please confirm you agree before continuing."),
});
export type StudentDetails = z.output<typeof studentDetailsSchema>;
export const STUDENT_DETAIL_FIELDS = ["curriculum", "institute", "district", "dateOfBirth", "gender", "phone", "whatsapp", "consent"] as const;
