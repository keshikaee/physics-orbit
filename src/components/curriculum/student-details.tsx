import type { StudentProfile } from "@/lib/content/queries";
import { ageOn, districtName, formatPhone, genderName } from "@/lib/curriculum/profile";
import { CurriculumForm } from "./curriculum-form";

/* Admin-only view of a student's personal and academic details. */
export function StudentDetails({
  student,
  curricula,
}: {
  student: StudentProfile;
  curricula: { slug: string; name: string; id: string }[];
}) {
  const current = curricula.find((c) => c.id === student.curriculum_id) ?? null;
  const rows: [string, React.ReactNode][] = [
    ["Curriculum", current?.name ?? <span className="text-orbit-warning">Not chosen yet</span>],
    ["Institute", student.institute ?? "—"],
    ["District", districtName(student.district) ?? "—"],
    [
      "Date of birth",
      student.date_of_birth
        ? `${new Date(`${student.date_of_birth}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} (age ${ageOn(student.date_of_birth)})`
        : "—",
    ],
    ["Gender", genderName(student.gender) ?? "Not given"],
    [
      "Contact number",
      student.phone ? (
        <>
          {formatPhone(student.phone)}
          {student.whatsapp_available && <span className="ml-2 rounded-full bg-orbit-primary-muted px-2 py-0.5 text-xs font-medium text-orbit-primary-hover">WhatsApp</span>}
        </>
      ) : (
        "—"
      ),
    ],
    [
      "Privacy consent",
      student.privacy_consent_at
        ? new Date(student.privacy_consent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "Not recorded",
    ],
  ];

  return (
    <section aria-labelledby="details-heading" className="rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-orbit-border-subtle p-5">
        <h2 id="details-heading" className="font-semibold text-orbit-text">
          Student details
        </h2>
        <p className="mt-1 text-sm text-orbit-text-secondary">Visible to admins only.</p>
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-orbit-text-muted">{label}</dt>
            <dd className="mt-0.5 text-sm text-orbit-text">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-orbit-border-subtle p-5">
        <CurriculumForm studentId={student.id} current={current?.slug ?? null} curricula={curricula} />
      </div>
    </section>
  );
}
