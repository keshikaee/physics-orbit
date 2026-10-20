# PHYSICS ORBIT — Project Instructions

## Project goal

Build a polished, functional, space-themed Learning Management System for Pearson Edexcel International AS Physics tuition classes.

## Source of truth

- Read `PROJECT_SPEC.md` before substantial implementation.
- Follow the product requirements and acceptance criteria in that file.
- Follow the latest architecture decisions explicitly approved by the project owner.
- If requirements conflict, explain the conflict before making significant changes.

## Development principles

- Inspect existing files before modifying them.
- Implement the project in small, testable phases.
- Preserve existing working functionality.
- Prefer simple, maintainable solutions over unnecessary dependencies.
- Use TypeScript and consistent coding conventions.
- Run relevant tests, linting, and type checks after significant changes.
- Do not claim a feature works unless it has been verified.
- Clearly distinguish working features, mock data, and unfinished integrations.
- Do not invent official Pearson Edexcel syllabus requirements.

## Security

- Enforce authorization on the server, not just in the UI.
- Keep student and teacher permissions separate.
- Protect student records, assessment attempts, and homework submissions.
- Use appropriate database access policies and private file storage.
- Never expose service-role keys, passwords, or other secrets in client-side code.
- Never commit `.env` files containing secrets.
- Ask before destructive database operations, public deployment, or actions that incur costs.

## Working process

For each task:

1. Explain the intended change briefly.
2. Implement the smallest coherent feature.
3. Run relevant checks and tests.
4. Report files changed and functionality completed.
5. Identify errors, limitations, and remaining work.
6. Recommend the next step.

Do not implement the entire LMS in one large operation. Complete and verify each major phase before moving on.

## Content management

- Keep course content editable through authorized teacher interfaces.
- Structure content by course, unit, topic, and lesson.
- Keep Unit 1 as the initial fully developed unit.
- Use clearly labelled placeholders for future units.
- Make physics calculations independently testable.
- Map practical activities to the verified specification and teaching plan.