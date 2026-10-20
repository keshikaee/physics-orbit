/* ─── Shared Application Types ─── */

export type UserRole = "student" | "teacher" | "admin";
export type AccountStatus = "active" | "suspended";

/** Mirrors public.curricula. */
export interface Curriculum {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: "active" | "archived";
  order_index: number;
}

/** Mirrors public.profiles (supabase/migrations). */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
  avatar_url: string | null;
  created_at: string;
  curriculum_id: string | null;
  /** Joined from curricula; null until the student has one. */
  curriculum: Pick<Curriculum, "id" | "slug" | "name" | "description"> | null;
}

/** Personal details only the student and admins can read (RLS). */
export interface StudentDetailsRow {
  date_of_birth: string | null;
  gender: string | null;
  district: string | null;
  institute: string | null;
  phone: string | null;
  whatsapp_available: boolean;
  privacy_consent_at: string | null;
}

/* ─── Course Hierarchy (mirrors supabase/migrations/*_course_structure.sql) ─── */

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type AccessMode = "all" | "selected";
export type ContentKind = "unit" | "topic" | "material";
export type MaterialKind = "pdf" | "video" | "link" | "note";

export interface Unit {
  id: string;
  course_id: string;
  slug: string;
  code: string; // e.g. "Unit 1"
  title: string;
  description: string;
  order_index: number;
  is_published: boolean;
  is_placeholder: boolean;
  needs_review: boolean;
  access_mode: AccessMode;
  created_at: string;
  updated_at: string;
}

/** A subtopic within a unit (table: topics). */
export interface Topic {
  id: string;
  unit_id: string;
  slug: string;
  title: string;
  description: string;
  order_index: number;
  is_published: boolean;
  needs_review: boolean;
  access_mode: AccessMode;
  created_at: string;
  updated_at: string;
}

/** A learning material within a subtopic. Mirrors public.materials. */
export interface Material {
  id: string;
  topic_id: string;
  kind: MaterialKind;
  title: string;
  description: string;
  notes: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  order_index: number;
  is_published: boolean;
  access_mode: AccessMode;
  created_at: string;
  updated_at: string;
}

/** One student allowed on one item (exactly one of the ids is set). */
export interface ContentGrant {
  student_id: string;
  unit_id: string | null;
  topic_id: string | null;
  material_id: string | null;
  node_id?: string | null;
}

/* ─── Roadmaps (mirrors *_roadmaps_quizzes_progress.sql) ─── */

export type NodeKind = "lesson" | "resource" | "quiz" | "milestone" | "final";
export type CompletionRule = "all_required" | "min_quizzes" | "student_mark" | "admin_confirm";
export type RestrictedDisplay = "hide" | "lock";

export interface Roadmap {
  id: string;
  unit_id: string;
  is_published: boolean;
  restricted_display: RestrictedDisplay;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RoadmapNode {
  id: string;
  roadmap_id: string;
  kind: NodeKind;
  title: string;
  description: string;
  pos_x: number;
  pos_y: number;
  topic_id: string | null;
  is_required: boolean;
  completion_rule: CompletionRule;
  min_quizzes: number | null;
  lock_until_prereqs: boolean;
  access_mode: AccessMode;
}

export interface RoadmapEdge {
  source_id: string;
  target_id: string;
}

/* ─── Quizzes ─── */

export type QuestionKind = "mcq_single" | "mcq_multi" | "short" | "numeric";
export type AnswerReveal = "never" | "after_submit" | "after_pass";
export type ToleranceKind = "absolute" | "percent";

export interface Quiz {
  id: string;
  node_id: string;
  title: string;
  description: string;
  order_index: number;
  pass_percent: number;
  max_attempts: number | null; // null = unlimited
  reveal: AnswerReveal;
  require_pass: boolean;
  is_required: boolean;
  is_published: boolean;
}

export interface QuestionChoice {
  id: string;
  question_id: string;
  label: string;
  order_index: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  kind: QuestionKind;
  prompt: string;
  image_path: string | null;
  marks: number;
  order_index: number;
}

/** Staff-only answer key. Never sent to students. */
export interface QuestionKey {
  question_id: string;
  correct_choice_ids: string[];
  numeric_answer: number | null;
  tolerance: number;
  tolerance_kind: ToleranceKind;
  units: string[];
  auto_exact: boolean;
  accepted_answers: string[];
  case_sensitive: boolean;
  model_answer: string;
  explanation: string;
}

/* ─── Progress ─── */

export type AttemptStatus = "awaiting_marking" | "marked";
export type CompletionSource = "auto" | "student" | "admin";

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  attempt_no: number;
  status: AttemptStatus;
  score: number;
  max_score: number;
  passed: boolean | null;
  submitted_at: string;
  marked_at: string | null;
}

export interface NodeCompletion {
  student_id: string;
  node_id: string;
  source: CompletionSource;
  completed_at: string;
}

/* ─── Virtual Lab ─── */

export interface Experiment {
  id: string;
  topic_id: string;
  title: string;
  component_key: string; // maps to a React component
  description: string;
  learning_objectives: string[];
  is_published: boolean;
  estimated_minutes: number;
}

export interface PracticalSession {
  id: string;
  experiment_id: string;
  student_id: string;
  started_at: string;
  completed_at?: string;
  data_table: unknown; // JSON — typed per experiment
  report?: PracticalReport;
}

export interface PracticalReport {
  aim: string;
  theory: string;
  apparatus: string;
  method: string;
  results_summary: string;
  calculations: string;
  uncertainty_analysis: string;
  evaluation: string;
  conclusion: string;
}

/* ─── Gamification ─── */

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
}

export interface EarnedAchievement {
  id: string;
  student_id: string;
  achievement_id: string;
  earned_at: string;
}
