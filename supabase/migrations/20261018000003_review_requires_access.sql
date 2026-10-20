-- Answer keys in attempt reviews: students only see them while they can
-- still open the quiz (published, permitted, step and parents visible).

-- An attempt with the answers revealed according to the quiz's setting.
create or replace function public.attempt_review(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_quiz public.quizzes;
  v_staff boolean := public.is_staff();
  v_reveal boolean;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt;
  if not found or (v_attempt.student_id <> auth.uid() and not v_staff) then
    return null;
  end if;
  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;
  -- Students only get answer keys for quizzes they can still open: if the
  -- admin later restricts or unpublishes it, past results stay visible but
  -- the answers do not.
  v_reveal := v_staff
    or (public.can_view_quiz(v_quiz.id)
        and (v_quiz.reveal = 'after_submit'
             or (v_quiz.reveal = 'after_pass' and v_attempt.passed is true)));

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'quiz', jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'pass_percent', v_quiz.pass_percent,
                               'reveal', v_quiz.reveal, 'node_id', v_quiz.node_id),
    'revealed', v_reveal,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'question_id', r.question_id,
        'kind', r.question_kind,
        'prompt', r.prompt,
        'marks_available', r.marks_available,
        'answer', r.answer,
        'awarded_marks', r.awarded_marks,
        'feedback', r.feedback,
        'image', q.image_path is not null,
        'choices', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.order_index)
          from public.question_choices c where c.question_id = r.question_id
        ), '[]'),
        'key', case when v_reveal and k.question_id is not null then jsonb_build_object(
          'correct_choice_ids', k.correct_choice_ids,
          'numeric_answer', k.numeric_answer,
          'tolerance', k.tolerance,
          'tolerance_kind', k.tolerance_kind,
          'units', k.units,
          'accepted_answers', k.accepted_answers,
          'model_answer', k.model_answer,
          'explanation', k.explanation
        ) end
      ) order by q.order_index nulls last, r.id)
      from public.attempt_responses r
      left join public.questions q on q.id = r.question_id
      left join public.question_keys k on k.question_id = r.question_id
      where r.attempt_id = p_attempt
    ), '[]')
  );
end;
$$;

