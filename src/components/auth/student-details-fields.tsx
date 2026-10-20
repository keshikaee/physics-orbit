"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { CURRICULA, DISTRICTS, GENDERS } from "@/lib/curriculum/profile";
import type { FieldErrors } from "@/lib/auth/schemas";
import { Field, inputClass } from "./form-parts";

/*
 * Academic + personal details, shared by registration and the one-time
 * "complete your profile" step. Values are validated again on the server
 * and in the database.
 */

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-2 text-sm font-semibold text-orbit-primary-text">{children}</h2>;
}

function Select({
  label,
  name,
  errors,
  defaultValue,
  required,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  defaultValue?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  const invalid = Boolean(errors?.length);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-orbit-text">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cn(inputClass, "appearance-auto")}
      >
        {children}
      </select>
      {invalid && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-orbit-error">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function StudentDetailsFields({
  values,
  errors,
}: {
  values?: Record<string, string>;
  errors?: FieldErrors;
}) {
  return (
    <>
      <SectionTitle>Academic information</SectionTitle>
      <Select label="Curriculum / syllabus" name="curriculum" required defaultValue={values?.curriculum} errors={errors?.curriculum}>
        <option value="" disabled>
          Select your curriculum
        </option>
        {CURRICULA.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name} — {c.hint}
          </option>
        ))}
      </Select>
      <Field
        label="Institute / examination centre"
        name="institute"
        placeholder="e.g. Royal College, Colombo"
        autoComplete="organization"
        maxLength={200}
        required
        defaultValue={values?.institute}
        errors={errors?.institute}
      />
      <Select label="District" name="district" required defaultValue={values?.district} errors={errors?.district}>
        <option value="" disabled>
          Select your district
        </option>
        {DISTRICTS.map(([slug, name]) => (
          <option key={slug} value={slug}>
            {name}
          </option>
        ))}
      </Select>

      <SectionTitle>Additional information</SectionTitle>
      <Field
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        autoComplete="bday"
        required
        defaultValue={values?.dateOfBirth}
        errors={errors?.dateOfBirth}
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-orbit-text">
          Gender <span className="font-normal text-orbit-text-muted">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {GENDERS.map(([slug, name]) => (
            <label
              key={slug}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-orbit-border px-3 py-2.5 text-sm text-orbit-text has-[:checked]:border-orbit-primary has-[:checked]:bg-orbit-panel-hover"
            >
              <input type="radio" name="gender" value={slug} defaultChecked={values?.gender === slug} className="h-4 w-4 accent-[#166534]" />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label="Contact number (WhatsApp preferred)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="077 123 4567 or +94 77 123 4567"
        required
        defaultValue={values?.phone}
        errors={errors?.phone}
      />
      <label className="-mt-1 flex cursor-pointer items-center gap-2.5 text-sm text-orbit-text">
        <input type="checkbox" name="whatsapp" defaultChecked={values?.whatsapp === "on"} className="h-4 w-4 accent-[#166534]" />
        This number is available on WhatsApp
      </label>

      <div className="rounded-xl border border-orbit-border bg-orbit-canvas p-3.5 text-xs leading-relaxed text-orbit-text-secondary">
        <p>
          Your details are used only to run your classes: to show you the right course and for your teacher to contact you. Only you
          and your teachers can see them — never other students. Your age is never shown publicly.
        </p>
        <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-sm text-orbit-text">
          <input type="checkbox" name="consent" defaultChecked={values?.consent === "on"} className="mt-0.5 h-4 w-4 shrink-0 accent-[#166534]" />
          <span>I agree to Physics Orbit storing these details. If I am under 18, my parent or guardian also agrees.</span>
        </label>
        {errors?.consent?.[0] && <p className="mt-1.5 text-xs text-orbit-error">{errors.consent[0]}</p>}
      </div>
    </>
  );
}
