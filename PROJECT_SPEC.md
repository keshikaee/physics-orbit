# MASTER PROJECT PROMPT: Build a Space-Themed Edexcel International A Level Physics LMS

Act as a senior full-stack software engineer, UI/UX designer, educational technology specialist, physics educator, and interactive simulation developer.

Your task is to design and build a polished, functional, modern Learning Management System (LMS) for my physics tuition classes. This is a real educational product intended for real students, not merely a landing page or a static UI prototype.

The application will initially support **Pearson Edexcel International AS Physics**, beginning with **Unit 1: Mechanics and Materials**. I will provide detailed content for other units later, so prepare the application architecture to support them without requiring major redesigns.

The main objective is to create an engaging digital physics academy where students can study independently, access all their learning materials, complete assignments, practise examination questions, and perform virtual physics practicals.

## 1. Product vision and identity

Create a digital physics academy that combines the structure of a professional LMS with the excitement of exploring the universe.

The experience should feel like entering a futuristic physics laboratory or space research station. Students should be motivated to return regularly, learn concepts deeply, and improve their examination performance.

Design principles:

- Visually exceptional, modern, immersive, and student-friendly.
- Space, astronomy, scientific instruments, physics experiments, and subtle futuristic elements.
- Clean information architecture that makes learning effortless.
- Professional enough for a real tuition business.
- Responsive across desktop, tablet, and mobile devices.
- Fast, accessible, and easy to maintain.
- Focused on actual learning outcomes rather than unnecessary animations or decoration.

Use a temporary product name such as **PHYSICS ORBIT**. Keep the application name, logo, colors, and branding easy to change later.

Do not copy the design of an existing LMS. Create an original visual identity.

## 2. User roles and authentication

Implement two primary roles.

### A. Student

Students must be able to:

- Register using their name, email address, and password.
- Sign in and sign out securely.
- Reset forgotten passwords.
- Access their personal dashboard.
- View enrolled courses, units, topics, and learning materials.
- Track completed lessons and overall progress.
- Download permitted resources.
- Complete quizzes, assignments, and mock examinations.
- Submit homework and view feedback and marks.
- Use virtual practical laboratories.
- Save bookmarks and personal revision notes.
- View deadlines, announcements, and notifications.
- See their assessment history and identify weak topics.
- Edit permitted profile settings.

Students must not be able to access teacher-only controls, other students' private submissions, or unpublished materials.

### B. Teacher / Administrator

I am the teacher and administrator. I need a dedicated dashboard to manage the entire learning environment.

I must be able to:

- View and manage registered students.
- Activate, suspend, or manage student access.
- Organize courses, units, topics, and lessons.
- Create, edit, publish, unpublish, and reorder learning materials.
- Upload PDF notes, worksheets, images, presentations, and other learning resources.
- Add external educational video links and embedded videos.
- Create homework, quizzes, timed tests, and mock examinations.
- Set deadlines, marks, attempt limits, and publication dates.
- Review homework submissions and attach marks and feedback.
- Create question banks organized by topic and difficulty.
- Add model answers, mark schemes, and worked solutions.
- Post class announcements.
- Monitor student progress and assessment performance.
- View students who are falling behind or missing deadlines.
- Preview the student experience before publishing content.

Provide a practical content-management interface so that I can manage the LMS without editing source code.

Only authorized administrators should be able to create teacher accounts or change user roles.

## 3. Main application structure

Build the following main pages and navigation.

1. Landing page
2. Student registration and login
3. Student dashboard
4. Course overview
5. Unit overview
6. Topic and lesson viewer
7. Notes and resource library
8. Homework and assignment centre
9. Quiz and examination interface
10. Virtual physics laboratory
11. Progress and performance analytics
12. Announcements and notifications
13. Student profile and settings
14. Teacher dashboard
15. Student management
16. Course and content management
17. Question bank and assessment builder
18. Assignment marking interface

Use a consistent sidebar or responsive navigation system. The student and teacher interfaces should have appropriate, separate navigation.

## 4. Student dashboard

The dashboard should be the student's personal learning command centre.

Include:

- A personalized welcome message.
- A visually attractive space-themed hero section.
- Current course and unit.
- Overall course completion percentage.
- Recently accessed lessons.
- Continue-learning button that resumes the last unfinished lesson.
- Upcoming homework and examination deadlines.
- Pending submissions.
- Recent marks and teacher feedback.
- Recommended topics for revision.
- Learning streak and earned achievements.
- Recent teacher announcements.
- Quick access to notes, past-paper practice, and virtual labs.

Use meaningful visualizations such as progress rings, small charts, and completion indicators where useful.

Do not fill the dashboard with meaningless statistics. Every displayed value must come from actual application data.

Include empty states for new students who have not yet completed lessons or submitted assignments.

## 5. Course and unit architecture

The initial course is:

**Pearson Edexcel International AS Physics**

Create a course hierarchy:

Course → Unit → Topic → Lesson → Learning Resources and Activities.

### Initial course structure

**Unit 1: Mechanics and Materials**

This unit must be the only fully developed unit initially.

**Unit 2: Waves and Electricity**

Create a placeholder.

**Unit 3: Practical Skills in Physics I**

Create a placeholder.

**Unit 4: Further Mechanics, Fields and Particles**

Create a placeholder.

**Unit 5: Thermodynamics, Radiation, Oscillations and Cosmology**

Create a placeholder.

**Unit 6: Practical Skills in Physics II**

Create a placeholder.

Verify unit names and content against the applicable Pearson Edexcel International Advanced Level Physics specification before publishing them. The above names are intended as an initial structure and should not be treated as a substitute for checking the official specification.

For Units 2–6, create attractive unit cards showing the unit name, a short placeholder description, and a clear "Content coming soon" state.

Do not invent lessons, notes, practicals, or examinations for these units. I will supply their content later.

Build the content system so that I can add or edit units, topics, and practicals through the administrator dashboard.

## 6. Fully develop Unit 1: Mechanics and Materials

Unit 1 should be the main demonstration of the platform's educational capabilities.

Organize the unit around the applicable Pearson Edexcel International AS Physics specification. Use the following as an initial topic structure and verify the precise specification statements, terminology, and practical requirements before finalizing the content.

### Topic 1: Physical quantities, units, and vectors

Include:

- SI base and derived quantities.
- SI units and unit conversions.
- Scalar and vector quantities.
- Vector representation and resolution into components.
- Significant figures and appropriate precision.
- Standard form and order of magnitude.
- Measurement uncertainty and relevant experimental limitations.

### Topic 2: Motion and kinematics

Include:

- Distance and displacement.
- Speed and velocity.
- Acceleration.
- Displacement-time graphs.
- Velocity-time graphs.
- Gradient and area interpretations.
- Equations of uniformly accelerated motion.
- Free fall and gravitational acceleration.
- Projectile motion where required by the specification.

### Topic 3: Forces and Newton's laws

Include:

- Types of forces and free-body diagrams.
- Resultant force.
- Newton's first, second, and third laws.
- Mass and weight.
- Resolving forces.
- Equilibrium.
- Friction and resistive forces where relevant.
- Momentum and impulse if included in the applicable specification.

### Topic 4: Work, energy, and power

Include:

- Work done by a force.
- Kinetic and gravitational potential energy.
- Conservation and transfer of energy.
- Efficiency.
- Power.
- Relevant equations, units, and practical applications.

### Topic 5: Materials and mechanical properties

Include:

- Density.
- Elastic deformation and plastic deformation.
- Hooke's law.
- Force-extension graphs.
- Stress and strain.
- Young modulus.
- Elastic potential energy where required.
- Experimental measurement and uncertainty.
- Material properties and their physical interpretation.

Treat this as a proposed initial structure, not permission to omit any official specification content. Verify all required learning outcomes, equations, definitions, and practical activities against the relevant specification.

### Required lesson structure

Every topic should contain lessons with a consistent structure:

1. Learning objectives.
2. Prerequisite knowledge.
3. Intuitive conceptual explanation.
4. Detailed scientific explanation.
5. Essential definitions.
6. Relevant equations with symbol definitions and SI units.
7. Step-by-step derivations where appropriate.
8. Worked numerical examples.
9. Diagrams, graphs, and illustrations.
10. Real-world applications.
11. Common student misconceptions.
12. Exam-style questions.
13. Short knowledge-check quizzes.
14. A topic summary.
15. Links to relevant notes, practicals, homework, and revision questions.

Use mathematical notation that renders correctly on desktop and mobile. Support fractions, powers, subscripts, Greek letters, vectors, and equations.

The lessons must be genuinely useful for AS Physics students. Do not fill the system with generic filler text.

Where reliable specification information is unavailable, mark the relevant content as requiring teacher review rather than inventing authoritative syllabus requirements.

## 7. Notes and educational resources

Create a dedicated resource centre inside each unit and topic.

Support these resource categories:

- Teacher's lecture notes.
- Concise revision notes.
- Formula sheets.
- Definitions and key terminology.
- Worked-example sheets.
- Worksheets.
- Homework PDFs.
- Diagrams and experimental setup illustrations.
- Educational videos.
- Past-paper question sets.
- Mark schemes and worked solutions.
- Practical instructions.
- Practical write-up templates.
- Additional reading.

Provide search, topic filters, resource-type filters, and clear file previews where supported.

Allow students to open PDFs in an in-app viewer and download resources when permitted.

Allow the teacher to upload and replace files without redeploying the application.

For past papers and official assessment materials, allow me to upload or link resources that I am authorized to distribute. Do not reproduce copyrighted examination papers or mark schemes wholesale without permission.

## 8. Virtual physics laboratory — a core feature

This is one of the most important features of the entire application.

Create a dedicated **Virtual Lab** section where students can conduct interactive experiments related to Unit 1.

Do not make these static illustrations or videos pretending to be experiments.

Students should be able to manipulate experimental parameters, observe physical changes, collect measurements, analyze data, and answer questions.

Build the simulation architecture so that new experiments can be added later without rebuilding the entire laboratory.

### Virtual lab interface

Each experiment should include:

- Experiment title and learning objectives.
- Background theory.
- Apparatus and experimental setup.
- Interactive simulation area.
- Adjustable variables and controls.
- Real-time measurement displays.
- Data table.
- Graph plotting.
- Calculations and analysis.
- Experimental procedure.
- Questions and evaluation.
- Sources of uncertainty and error.
- Conclusion and report generation.
- Reset and repeat functionality.

### Initial experiment ideas

Create the experiments only where they align with the official Unit 1 requirements and my eventual teaching plan.

**Experiment A: Motion and acceleration**

Allow students to investigate motion using a simulated trolley or moving object.

Potential controls include mass, applied force, starting velocity, and surface resistance, where applicable.

Display position, velocity, and time data. Allow students to investigate relationships and plot appropriate graphs.

**Experiment B: Newton's second law**

Allow students to change mass and resultant force and observe the effect on acceleration.

Display measured values and allow students to investigate the relationship between force, mass, and acceleration.

Provide an option to introduce realistic measurement noise for experimental analysis.

**Experiment C: Hooke's law and elastic behaviour**

Allow students to apply different forces to a spring or suitable elastic material.

Display extension and force readings, with a graph plotting interface.

Allow students to investigate the proportional region and identify departures from linear behaviour when appropriate.

**Experiment D: Young modulus and material properties**

Where appropriate to the syllabus and practical requirements, allow students to investigate a material under tension, vary load, measure extension, and calculate stress, strain, and Young modulus.

Clearly distinguish idealized simulation values from experimental measurements and estimates.

**Experiment E: Density and measurement**

Provide a virtual setup where students can measure dimensions and mass, calculate volume and density, and consider the effects of measurement uncertainty.

The final set of practicals must be mapped to the official Unit 1 practical requirements. Do not claim that every suggested experiment is an official core practical without verifying it.

### Graphing and analysis

Students should be able to:

- Collect multiple measurements.
- Add or remove data points where appropriate.
- Select suitable graph axes.
- Plot scatter graphs.
- View best-fit lines where appropriate.
- Read gradients and intercepts.
- Compare their results with expected relationships.
- Export or save their experimental results.
- Answer analysis questions.

Use an appropriate graphing library and an actual physics-based calculation model.

The underlying calculations must be correct and testable.

### Practical reports

Allow students to create a structured report containing:

- Aim.
- Theory.
- Apparatus.
- Method.
- Results table.
- Graphs.
- Calculations.
- Uncertainty analysis.
- Evaluation.
- Conclusion.

Save progress so students can return to an unfinished practical.

Where possible, automatically evaluate numerical answers with appropriate tolerances, units, and significant-figure rules.

Include hints and explanations that support learning instead of simply revealing answers.

## 9. Homework, quizzes, and mock examinations

Create a complete assessment system.

### Question types

Support:

- Single-answer multiple choice.
- Multiple-select questions.
- Numerical answers.
- Questions requiring units.
- Short written answers.
- Extended written responses.
- Diagram-based questions.
- Graph interpretation.
- Multi-part questions.

Structure questions so they can be reused in lessons, homework, topic tests, and mock examinations.

### Homework workflow

1. Teacher creates an assignment.
2. Teacher selects the relevant unit and topics.
3. Teacher sets a deadline, instructions, marks, and attempt rules.
4. Students receive the assignment.
5. Students submit answers or permitted files.
6. The system automatically marks supported objective questions.
7. The teacher reviews written responses and file submissions.
8. The teacher provides marks and feedback.
9. Students view their results and correct misunderstandings.

Track submission status: not started, in progress, submitted, marked, or overdue.

### Examination mode

Provide a focused exam interface with:

- A visible countdown timer.
- Question navigation.
- Mark allocation.
- Answer saving.
- Question flagging.
- Clear submission confirmation.
- Automatic submission when the timer expires, where appropriate.
- Results and feedback after the configured release time.

Support randomized question selection from a question bank.

Provide a teacher-configurable mock examination system with topic coverage, time limits, and scoring.

Do not claim that a normal browser-based examination is fully cheat-proof.

### Marking and feedback

Allow the teacher to add marking criteria and model answers.

Provide automated marking only when the answer type and grading rules support it reliably. Written answers should be available for teacher review.

Give students meaningful explanations of errors, not just a score.

## 10. Student progress and learning analytics

Track:

- Lessons opened and completed.
- Quiz scores.
- Homework submission status.
- Assessment history.
- Time spent on learning activities where reliably measurable.
- Practical completion.
- Topic-level strengths and weaknesses.
- Overall progress through the course.

Create a teacher analytics dashboard showing class performance and individual student progress.

Identify topics where students frequently answer questions incorrectly.

Use transparent, explainable rules to recommend revision activities. For example, if a student repeatedly struggles with velocity-time graphs, recommend the relevant lesson and practice questions.

Do not use fabricated data in live dashboards. Demo data may be used only in a clearly labeled demonstration or preview environment.

## 11. Gamification and motivation

Use subtle gamification to make learning engaging without making it feel childish.

Include:

- XP for completing learning activities.
- Achievement badges.
- Topic mastery milestones.
- Learning streaks.
- Unit completion achievements.
- Personal progress milestones.
- Optional class leaderboard.

Award points for meaningful educational activity, not merely opening pages.

Avoid allowing students to earn unlimited rewards through repetitive actions.

Leaderboards must be optional and should not publicly expose sensitive student information.

## 12. UI/UX design direction

Create an original, premium-quality visual system.

### Visual theme

Use a sophisticated space and physics aesthetic:

- Deep navy or near-black backgrounds.
- Indigo, electric blue, and violet accents.
- Subtle cyan highlights.
- White or light-gray typography with strong contrast.
- Carefully controlled gradients.
- Minimal star fields or cosmic backgrounds.
- Scientific diagrams and orbital illustrations.
- Subtle glowing edges and translucent panels where appropriate.
- Clean charts and experimental interfaces.

Use the space theme to enhance the product rather than overwhelm the educational content.

### Typography and layout

Use a modern, readable typeface.

Use clear heading hierarchy, comfortable line spacing, and sufficient whitespace.

Math-heavy lesson pages must prioritize readability.

Use reusable cards, tabs, badges, progress indicators, tooltips, dialogs, and accessible form controls.

Use animations sparingly and provide reduced-motion support.

Avoid excessive neon effects, unnecessary parallax, constant moving stars, giant empty hero sections, and layouts that make content difficult to read.

### Responsive behaviour

The complete application must work on:

- Desktop computers.
- Laptops.
- Tablets.
- Mobile phones.

On smaller screens, use a responsive navigation pattern and stack cards appropriately.

The virtual laboratory must remain usable on touch devices, including its controls, tables, and graphs.

### Essential UI states

Design loading, empty, success, error, and permission-denied states.

Provide helpful messages when no homework is available, when an upload fails, or when a student has not started a unit.

Every button, menu, filter, and navigation item must have a meaningful function.

Do not create decorative buttons that do nothing.

## 13. Technical architecture

Choose a modern, maintainable full-stack architecture.

If working in an existing repository, inspect the current codebase and preserve appropriate working components.

If starting from scratch, use a practical stack such as:

- Frontend: Next.js with TypeScript.
- UI: Tailwind CSS and a consistent accessible component system.
- Backend: Next.js server-side functionality or an appropriate separate API.
- Database: PostgreSQL.
- Authentication: a secure authentication solution compatible with the chosen architecture.
- File storage: private object storage for uploaded learning resources and submissions.
- Graphs: a suitable interactive charting library.
- Mathematical notation: KaTeX or MathJax.
- Validation: schema-based validation for forms and API inputs.

A managed PostgreSQL and authentication platform such as Supabase may be used if it makes the project easier to deploy and maintain.

Choose one coherent architecture rather than combining unnecessary technologies.

Use environment variables for secrets. Include an example environment configuration without real credentials.

### Data model

Design an appropriate relational schema covering at least:

- Users and roles.
- Student profiles.
- Courses.
- Units.
- Topics.
- Lessons.
- Learning resources.
- Practical experiments.
- Practical sessions and results.
- Assignments.
- Assignment submissions.
- Questions.
- Question options.
- Question banks.
- Quizzes and examinations.
- Student answers.
- Grades and feedback.
- Lesson progress.
- Announcements.
- Notifications.
- Bookmarks and revision notes.
- Achievement definitions and earned achievements.

Use appropriate foreign keys, constraints, timestamps, and indexes.

Avoid storing all application content in a single large JSON field when relational structures are more appropriate.

Design the schema so that additional units and experiments can be added easily.

### Security requirements

Implement:

- Secure password handling through the chosen authentication provider.
- Server-side authorization checks.
- Role-based access control.
- Protected teacher routes.
- Appropriate database access policies.
- Input validation and output escaping.
- Safe file-upload restrictions.
- Private storage for student submissions.
- Protection against unauthorized access to other students' records.
- Secure session management.
- Appropriate error handling and logging.

Never rely solely on hiding a button in the frontend to protect an administrator function.

Use least-privilege access and avoid exposing secret keys in client-side code.

## 14. Real functionality, not just a mockup

This requirement is critical.

The application must have a working frontend, backend, database, authentication, and persistence wherever those features are implemented.

Examples:

- Registration should create a real user account.
- Login should authenticate the user.
- Uploaded files should be stored and retrievable.
- Student progress should persist across sessions.
- Assignments should be stored in the database.
- Submissions should be visible to the teacher.
- Grades and feedback should be saved.
- Virtual experiments should calculate results from their actual simulation models.
- Teacher changes should appear in the student interface after publication.

If external credentials or service configuration are unavailable, implement the integration points and document exactly what must be configured. Do not falsely claim that an unconfigured integration is working.

Use sample data only where appropriate, and clearly distinguish sample content from real student records.

## 15. Testing and reliability

Create tests for the most important functions, including:

- Authentication and access control.
- Student versus teacher permissions.
- Course and lesson retrieval.
- Assignment creation and submission.
- Objective-question grading.
- Progress persistence.
- Virtual experiment calculations.
- File access restrictions.
- Responsive navigation.

Handle errors gracefully.

Check that mathematical equations render correctly and that charts use valid data.

Ensure the application does not lose student answers when navigating between exam questions or refreshing a page, within the supported session and saving model.

## 16. Development and delivery workflow

Work in phases.

### Phase 1: Plan and foundation

Inspect the environment, define the architecture, establish the design system, and create the core database schema.

### Phase 2: Functional LMS

Implement authentication, student and teacher dashboards, course navigation, content management, resource uploads, and student progress.

### Phase 3: Unit 1 content

Build the full Unit 1 structure and initial teacher-editable learning content.

### Phase 4: Assessments

Implement quizzes, homework, question banks, examinations, submissions, marking, and feedback.

### Phase 5: Virtual laboratory

Implement the initial interactive Unit 1 experiments with physics-based models, measurements, graphs, and report saving.

### Phase 6: Polish and validation

Test the complete user journey, improve accessibility and responsive behaviour, fix bugs, and verify permissions.

Prioritize a working end-to-end application over a large number of unfinished features.

If time or environment limitations prevent everything from being completed in one pass, deliver a coherent, functional MVP first, with a clear list of remaining work.

## 17. Final deliverables

Provide:

1. The complete application source code.
2. A clear project directory structure.
3. Database schema and migrations.
4. Authentication and authorization implementation.
5. Seed data for the initial course and Unit 1.
6. Reusable UI components.
7. Working student and teacher dashboards.
8. A functional Unit 1 learning environment.
9. Initial interactive virtual experiments.
10. Assessment and homework functionality.
11. Automated tests for critical features.
12. An `.env.example` file.
13. A README with installation and configuration instructions.
14. Database setup instructions.
15. Instructions for creating the first administrator account securely.
16. Deployment instructions.
17. A list of any external services, credentials, or configuration still required.

Do not expose administrator passwords or secrets in source code or documentation.

## 18. Acceptance criteria

Consider the initial product successful when:

- A student can register, log in, and access the student dashboard.
- A teacher can securely manage students and publish Unit 1 learning materials.
- Unit 1 has an organized, specification-aligned topic and lesson structure.
- Students can access notes and resources by topic.
- Students can complete a quiz and see their saved results.
- Students can submit homework and receive teacher feedback.
- Students can use at least one fully functional physics simulation, collect data, and plot a graph.
- Student progress persists in the database.
- Other units appear as well-designed placeholders.
- The interface is responsive, visually polished, and accessible.
- Core permissions and data privacy are tested.
- The project can be installed and run by following the README.

## 19. Instructions for you, Claude

Start by inspecting the existing project and explaining the proposed architecture and implementation plan briefly.

Then proceed to build the application, not just describe how it could be built.

If you are operating in a coding environment, create and modify the actual project files, install compatible dependencies when permitted, run the application and tests, and fix errors where possible.

Make sensible decisions without asking me about every small design choice.

Ask me only when a decision genuinely requires information that cannot be reasonably assumed.

Do not invent syllabus requirements, claim unverified practicals are official, or fill the product with generic placeholder content disguised as finished educational material.

The application should be designed for long-term use in a real physics tuition business. Make it attractive enough that students enjoy using it, rigorous enough that they can learn physics properly, and practical enough that I can manage my classes without unnecessary administrative work.

**Begin with the architecture and then implement the highest-priority functional features.**