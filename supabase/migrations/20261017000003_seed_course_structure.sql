-- ─────────────────────────────────────────────────────────────
-- Seed: initial course structure (from PROJECT_SPEC.md §5–6)
--
-- ⚠ Unit names and Unit 1 topics are the project owner's PROPOSED
--   structure. They have NOT been verified against the official Pearson
--   Edexcel specification, so every row is needs_review = true until the
--   teacher confirms it in the content manager.
--
-- No lessons are seeded — the teacher adds them.
-- Re-running is safe (on conflict do nothing).
-- ─────────────────────────────────────────────────────────────

insert into public.courses (slug, title, description, is_published)
values (
  'edexcel-ias-physics',
  'Pearson Edexcel International AS Physics',
  'International Advanced Subsidiary Physics, starting with Unit 1: Mechanics and Materials.',
  true
)
on conflict (slug) do nothing;

with c as (select id from public.courses where slug = 'edexcel-ias-physics')
insert into public.units (course_id, slug, code, title, description, order_index, is_published, is_placeholder)
select c.id, u.slug, u.code, u.title, u.description, u.order_index, true, u.is_placeholder
from c, (values
  ('unit-1', 'Unit 1', 'Mechanics and Materials',
   'Physical quantities, motion and kinematics, forces and Newton''s laws, work, energy and power, and the mechanical properties of materials.',
   1, false),
  ('unit-2', 'Unit 2', 'Waves and Electricity',
   'Placeholder — content will be supplied by the teacher.', 2, true),
  ('unit-3', 'Unit 3', 'Practical Skills in Physics I',
   'Placeholder — content will be supplied by the teacher.', 3, true),
  ('unit-4', 'Unit 4', 'Further Mechanics, Fields and Particles',
   'Placeholder — content will be supplied by the teacher.', 4, true),
  ('unit-5', 'Unit 5', 'Thermodynamics, Radiation, Oscillations and Cosmology',
   'Placeholder — content will be supplied by the teacher.', 5, true),
  ('unit-6', 'Unit 6', 'Practical Skills in Physics II',
   'Placeholder — content will be supplied by the teacher.', 6, true)
) as u(slug, code, title, description, order_index, is_placeholder)
on conflict (course_id, slug) do nothing;

with u as (
  select units.id from public.units
  join public.courses on courses.id = units.course_id
  where courses.slug = 'edexcel-ias-physics' and units.slug = 'unit-1'
)
insert into public.topics (unit_id, slug, title, description, order_index, is_published)
select u.id, t.slug, t.title, t.description, t.order_index, true
from u, (values
  ('physical-quantities', 'Physical quantities, units and vectors',
   'SI base and derived quantities and units, scalars and vectors, resolving vectors, significant figures, standard form and measurement uncertainty.', 1),
  ('motion-and-kinematics', 'Motion and kinematics',
   'Displacement, velocity and acceleration, motion graphs, equations of uniformly accelerated motion, free fall and projectile motion.', 2),
  ('forces-and-newtons-laws', 'Forces and Newton''s laws',
   'Free-body diagrams, resultant force, Newton''s laws of motion, mass and weight, resolving forces, equilibrium and resistive forces.', 3),
  ('work-energy-power', 'Work, energy and power',
   'Work done by a force, kinetic and gravitational potential energy, conservation of energy, efficiency and power.', 4),
  ('materials', 'Materials and mechanical properties',
   'Density, elastic and plastic deformation, Hooke''s law, force–extension graphs, stress, strain and the Young modulus.', 5)
) as t(slug, title, description, order_index)
on conflict (unit_id, slug) do nothing;
