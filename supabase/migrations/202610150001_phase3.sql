-- StudySpace schema 3. Apply once in Supabase SQL Editor (transactional).
-- Personal data remains protected by auth.uid(), including all foreign-key owners.
begin;
create table public.studyspace_workspaces (
 owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 mutation_id text,
 settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object'),
 study_preferences jsonb not null default '{}'::jsonb check(jsonb_typeof(study_preferences)='object'),
 integration_preferences jsonb not null default '{"lastClassroomSync":null}'::jsonb check(jsonb_typeof(integration_preferences)='object'),
 updated_at timestamptz not null default now()
);
create table public.studyspace_courses (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 check(payload->>'color' ~ '^#[0-9a-fA-F]{6}$'),
 check(length(payload->>'name') between 1 and 100)
);
create table public.studyspace_tasks (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 check(payload->>'status' in ('pendiente','progreso','completada')),
 check(payload->>'priority' in ('baja','media','alta','urgente')),
 check(payload->>'dueDate' = '' or payload->>'dueDate' ~ '^\d{4}-\d{2}-\d{2}$')
);
create index on public.studyspace_tasks(owner_id,course_id);
create table public.studyspace_events (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_events(owner_id,course_id);
create table public.studyspace_units (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_units(owner_id,course_id);
create table public.studyspace_topics (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 unit_id text generated always as (payload->>'unitId') stored,
 foreign key(owner_id,unit_id) references public.studyspace_units(owner_id,id) deferrable initially deferred,
 parent_id text generated always as (payload->>'parentId') stored,
 foreign key(owner_id,parent_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 check((payload->>'difficulty')::int between 1 and 3),
 check((payload->>'mastery')::int between 0 and 3)
);
create index on public.studyspace_topics(owner_id,unit_id);
create index on public.studyspace_topics(owner_id,parent_id);
create table public.studyspace_plans (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 task_id text generated always as (payload->>'targetTaskId') stored,
 foreign key(owner_id,task_id) references public.studyspace_tasks(owner_id,id) deferrable initially deferred,
 check(payload->>'targetDate'>=payload->>'startDate'),
 check(jsonb_typeof(payload->'topicIds')='array')
);
create index on public.studyspace_plans(owner_id,course_id);
create index on public.studyspace_plans(owner_id,task_id);
create table public.studyspace_scheduled_sessions (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 topic_id text generated always as (payload->>'topicId') stored,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 plan_id text generated always as (payload->>'planId') stored,
 foreign key(owner_id,plan_id) references public.studyspace_plans(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_scheduled_sessions(owner_id,course_id);
create index on public.studyspace_scheduled_sessions(owner_id,topic_id);
create index on public.studyspace_scheduled_sessions(owner_id,plan_id);
create table public.studyspace_study_logs (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 topic_id text generated always as (payload->>'topicId') stored,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 plan_id text generated always as (payload->>'planId') stored,
 foreign key(owner_id,plan_id) references public.studyspace_plans(owner_id,id) deferrable initially deferred,
 session_id text generated always as (payload->>'sessionId') stored,
 foreign key(owner_id,session_id) references public.studyspace_scheduled_sessions(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_study_logs(owner_id,course_id);
create index on public.studyspace_study_logs(owner_id,topic_id);
create index on public.studyspace_study_logs(owner_id,plan_id);
create index on public.studyspace_study_logs(owner_id,session_id);
create table public.studyspace_review_history (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 topic_id text generated always as (payload->>'topicId') stored,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 log_id text generated always as (payload->>'logId') stored,
 foreign key(owner_id,log_id) references public.studyspace_study_logs(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_review_history(owner_id,topic_id);
create index on public.studyspace_review_history(owner_id,log_id);
create table public.studyspace_folders (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 parent_id text generated always as (payload->>'parentId') stored,
 foreign key(owner_id,parent_id) references public.studyspace_folders(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_folders(owner_id,course_id);
create index on public.studyspace_folders(owner_id,parent_id);
create table public.studyspace_documents (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 folder_id text generated always as (payload->>'folderId') stored,
 foreign key(owner_id,folder_id) references public.studyspace_folders(owner_id,id) deferrable initially deferred,
 topic_id text generated always as (payload->>'topicId') stored,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 check(payload->>'url' ~ '^https?://'),
 check(payload->>'source' in ('manual','drive','classroom'))
);
create index on public.studyspace_documents(owner_id,course_id);
create index on public.studyspace_documents(owner_id,folder_id);
create index on public.studyspace_documents(owner_id,topic_id);
create table public.studyspace_classroom_links (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 external_course text generated always as (payload->>'externalCourseId') stored,
 unique(owner_id,external_course)
);
create index on public.studyspace_classroom_links(owner_id,course_id);
create table public.studyspace_classroom_items (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 task_id text generated always as (payload->>'taskId') stored,
 foreign key(owner_id,task_id) references public.studyspace_tasks(owner_id,id) deferrable initially deferred,
 external_course text generated always as (payload->>'externalCourseId') stored,
 external_work text generated always as (payload->>'externalWorkId') stored,
 unique(owner_id,external_course,external_work)
);
create index on public.studyspace_classroom_items(owner_id,task_id);
create table public.studyspace_timers (
 owner_id uuid not null default auth.uid() references public.studyspace_workspaces(owner_id) on delete cascade,
 id text not null check(length(id) between 1 and 100),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'id'=id),
 primary key(owner_id,id),
 course_id text generated always as (payload->>'courseId') stored,
 foreign key(owner_id,course_id) references public.studyspace_courses(owner_id,id) deferrable initially deferred,
 topic_id text generated always as (payload->>'topicId') stored,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred,
 plan_id text generated always as (payload->>'planId') stored,
 foreign key(owner_id,plan_id) references public.studyspace_plans(owner_id,id) deferrable initially deferred,
 session_id text generated always as (payload->>'sessionId') stored,
 foreign key(owner_id,session_id) references public.studyspace_scheduled_sessions(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_timers(owner_id,course_id);
create index on public.studyspace_timers(owner_id,topic_id);
create index on public.studyspace_timers(owner_id,plan_id);
create index on public.studyspace_timers(owner_id,session_id);
create table public.studyspace_plan_topics (
 owner_id uuid not null default auth.uid(), plan_id text not null, topic_id text not null,
 primary key(owner_id,plan_id,topic_id),
 foreign key(owner_id,plan_id) references public.studyspace_plans(owner_id,id) deferrable initially deferred,
 foreign key(owner_id,topic_id) references public.studyspace_topics(owner_id,id) deferrable initially deferred
);
create index on public.studyspace_plan_topics(owner_id,topic_id);
create unique index studyspace_completed_session_once on public.studyspace_study_logs(owner_id,session_id) where session_id is not null and payload->>'status'='completed';
create unique index studyspace_one_timer on public.studyspace_timers(owner_id);
alter table public.studyspace_workspaces enable row level security;
alter table public.studyspace_workspaces force row level security;
create policy own_rows on public.studyspace_workspaces for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_workspaces from anon;
grant select,insert,update,delete on public.studyspace_workspaces to authenticated;
alter table public.studyspace_courses enable row level security;
alter table public.studyspace_courses force row level security;
create policy own_rows on public.studyspace_courses for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_courses from anon;
grant select,insert,update,delete on public.studyspace_courses to authenticated;
alter table public.studyspace_tasks enable row level security;
alter table public.studyspace_tasks force row level security;
create policy own_rows on public.studyspace_tasks for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_tasks from anon;
grant select,insert,update,delete on public.studyspace_tasks to authenticated;
alter table public.studyspace_events enable row level security;
alter table public.studyspace_events force row level security;
create policy own_rows on public.studyspace_events for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_events from anon;
grant select,insert,update,delete on public.studyspace_events to authenticated;
alter table public.studyspace_units enable row level security;
alter table public.studyspace_units force row level security;
create policy own_rows on public.studyspace_units for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_units from anon;
grant select,insert,update,delete on public.studyspace_units to authenticated;
alter table public.studyspace_topics enable row level security;
alter table public.studyspace_topics force row level security;
create policy own_rows on public.studyspace_topics for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_topics from anon;
grant select,insert,update,delete on public.studyspace_topics to authenticated;
alter table public.studyspace_plans enable row level security;
alter table public.studyspace_plans force row level security;
create policy own_rows on public.studyspace_plans for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_plans from anon;
grant select,insert,update,delete on public.studyspace_plans to authenticated;
alter table public.studyspace_scheduled_sessions enable row level security;
alter table public.studyspace_scheduled_sessions force row level security;
create policy own_rows on public.studyspace_scheduled_sessions for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_scheduled_sessions from anon;
grant select,insert,update,delete on public.studyspace_scheduled_sessions to authenticated;
alter table public.studyspace_study_logs enable row level security;
alter table public.studyspace_study_logs force row level security;
create policy own_rows on public.studyspace_study_logs for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_study_logs from anon;
grant select,insert,update,delete on public.studyspace_study_logs to authenticated;
alter table public.studyspace_review_history enable row level security;
alter table public.studyspace_review_history force row level security;
create policy own_rows on public.studyspace_review_history for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_review_history from anon;
grant select,insert,update,delete on public.studyspace_review_history to authenticated;
alter table public.studyspace_folders enable row level security;
alter table public.studyspace_folders force row level security;
create policy own_rows on public.studyspace_folders for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_folders from anon;
grant select,insert,update,delete on public.studyspace_folders to authenticated;
alter table public.studyspace_documents enable row level security;
alter table public.studyspace_documents force row level security;
create policy own_rows on public.studyspace_documents for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_documents from anon;
grant select,insert,update,delete on public.studyspace_documents to authenticated;
alter table public.studyspace_classroom_links enable row level security;
alter table public.studyspace_classroom_links force row level security;
create policy own_rows on public.studyspace_classroom_links for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_classroom_links from anon;
grant select,insert,update,delete on public.studyspace_classroom_links to authenticated;
alter table public.studyspace_classroom_items enable row level security;
alter table public.studyspace_classroom_items force row level security;
create policy own_rows on public.studyspace_classroom_items for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_classroom_items from anon;
grant select,insert,update,delete on public.studyspace_classroom_items to authenticated;
alter table public.studyspace_timers enable row level security;
alter table public.studyspace_timers force row level security;
create policy own_rows on public.studyspace_timers for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_timers from anon;
grant select,insert,update,delete on public.studyspace_timers to authenticated;
alter table public.studyspace_plan_topics enable row level security;
alter table public.studyspace_plan_topics force row level security;
create policy own_rows on public.studyspace_plan_topics for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.studyspace_plan_topics from anon;
grant select,insert,update,delete on public.studyspace_plan_topics to authenticated;
alter table public.studyspace_courses add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_tasks add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_events add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_units add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_topics add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_plans add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_scheduled_sessions add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_study_logs add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_review_history add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_folders add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_documents add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_classroom_links add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_classroom_items add column ordinal integer not null default 0 check(ordinal>=0);
alter table public.studyspace_timers add column ordinal integer not null default 0 check(ordinal>=0);
create or replace function public.studyspace_read() returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.studyspace_workspaces;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 -- Shared lock gives one consistent graph even while another device saves.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into w from public.studyspace_workspaces where owner_id=auth.uid();
 if not found or w.revision=0 then return jsonb_build_object('revision',0,'state',null,'mutation_id',null);end if;
 return jsonb_build_object('revision',w.revision,'mutation_id',w.mutation_id,'state',jsonb_build_object(
'schemaVersion',3,
'settings',w.settings,
'studyPreferences',w.study_preferences,
'integrationPreferences',w.integration_preferences,
'activeTimer',(select payload from public.studyspace_timers where owner_id=auth.uid()),
'courses',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_courses where owner_id=auth.uid()) x),'[]'::jsonb),
'tasks',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_tasks where owner_id=auth.uid()) x),'[]'::jsonb),
'events',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_events where owner_id=auth.uid()) x),'[]'::jsonb),
'units',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_units where owner_id=auth.uid()) x),'[]'::jsonb),
'topics',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_topics where owner_id=auth.uid()) x),'[]'::jsonb),
'plans',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_plans where owner_id=auth.uid()) x),'[]'::jsonb),
'scheduledSessions',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_scheduled_sessions where owner_id=auth.uid()) x),'[]'::jsonb),
'studyLogs',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_study_logs where owner_id=auth.uid()) x),'[]'::jsonb),
'reviewHistory',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_review_history where owner_id=auth.uid()) x),'[]'::jsonb),
'folders',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_folders where owner_id=auth.uid()) x),'[]'::jsonb),
'documents',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_documents where owner_id=auth.uid()) x),'[]'::jsonb),
'classroomLinks',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_classroom_links where owner_id=auth.uid()) x),'[]'::jsonb),
'classroomItems',coalesce((select jsonb_agg(payload order by ordinal) from (select payload,ordinal from public.studyspace_classroom_items where owner_id=auth.uid()) x),'[]'::jsonb)));
end $$;
create or replace function public.studyspace_save(p_state jsonb,p_expected_revision bigint,p_mutation_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; last_mutation text; item jsonb; n integer; p jsonb; tid jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_mutation_id is null or length(p_mutation_id) not between 1 and 100 then raise exception 'INVALID_MUTATION';end if;
 if p_state->>'schemaVersion' is distinct from '3' or jsonb_typeof(p_state->'settings') is distinct from 'object' or jsonb_typeof(p_state->'studyPreferences') is distinct from 'object' or jsonb_typeof(p_state->'integrationPreferences') is distinct from 'object' then raise exception 'INVALID_SCHEMA';end if;
 if octet_length(p_state::text)>20000000 then raise exception 'STATE_TOO_LARGE';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 insert into public.studyspace_workspaces(owner_id) values(auth.uid()) on conflict do nothing;
 select revision,mutation_id into current_revision,last_mutation from public.studyspace_workspaces where owner_id=auth.uid() for update;
 if last_mutation=p_mutation_id then return public.studyspace_read();end if;
 if current_revision<>p_expected_revision then raise exception 'REVISION_CONFLICT';end if;
 set constraints all deferred;
delete from public.studyspace_plan_topics where owner_id=auth.uid();
delete from public.studyspace_timers where owner_id=auth.uid();
delete from public.studyspace_classroom_items where owner_id=auth.uid();
delete from public.studyspace_classroom_links where owner_id=auth.uid();
delete from public.studyspace_documents where owner_id=auth.uid();
delete from public.studyspace_folders where owner_id=auth.uid();
delete from public.studyspace_review_history where owner_id=auth.uid();
delete from public.studyspace_study_logs where owner_id=auth.uid();
delete from public.studyspace_scheduled_sessions where owner_id=auth.uid();
delete from public.studyspace_plans where owner_id=auth.uid();
delete from public.studyspace_topics where owner_id=auth.uid();
delete from public.studyspace_units where owner_id=auth.uid();
delete from public.studyspace_events where owner_id=auth.uid();
delete from public.studyspace_tasks where owner_id=auth.uid();
delete from public.studyspace_courses where owner_id=auth.uid();
if jsonb_typeof(p_state->'courses') is distinct from 'array' or jsonb_array_length(p_state->'courses')>50000 then raise exception 'INVALID_COLLECTION: courses';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'courses') loop
 insert into public.studyspace_courses(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'tasks') is distinct from 'array' or jsonb_array_length(p_state->'tasks')>50000 then raise exception 'INVALID_COLLECTION: tasks';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'tasks') loop
 insert into public.studyspace_tasks(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'events') is distinct from 'array' or jsonb_array_length(p_state->'events')>50000 then raise exception 'INVALID_COLLECTION: events';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'events') loop
 insert into public.studyspace_events(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'units') is distinct from 'array' or jsonb_array_length(p_state->'units')>50000 then raise exception 'INVALID_COLLECTION: units';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'units') loop
 insert into public.studyspace_units(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'topics') is distinct from 'array' or jsonb_array_length(p_state->'topics')>50000 then raise exception 'INVALID_COLLECTION: topics';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'topics') loop
 insert into public.studyspace_topics(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'plans') is distinct from 'array' or jsonb_array_length(p_state->'plans')>50000 then raise exception 'INVALID_COLLECTION: plans';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'plans') loop
 insert into public.studyspace_plans(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'scheduledSessions') is distinct from 'array' or jsonb_array_length(p_state->'scheduledSessions')>50000 then raise exception 'INVALID_COLLECTION: scheduledSessions';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'scheduledSessions') loop
 insert into public.studyspace_scheduled_sessions(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'studyLogs') is distinct from 'array' or jsonb_array_length(p_state->'studyLogs')>50000 then raise exception 'INVALID_COLLECTION: studyLogs';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'studyLogs') loop
 insert into public.studyspace_study_logs(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'reviewHistory') is distinct from 'array' or jsonb_array_length(p_state->'reviewHistory')>50000 then raise exception 'INVALID_COLLECTION: reviewHistory';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'reviewHistory') loop
 insert into public.studyspace_review_history(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'folders') is distinct from 'array' or jsonb_array_length(p_state->'folders')>50000 then raise exception 'INVALID_COLLECTION: folders';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'folders') loop
 insert into public.studyspace_folders(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'documents') is distinct from 'array' or jsonb_array_length(p_state->'documents')>50000 then raise exception 'INVALID_COLLECTION: documents';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'documents') loop
 insert into public.studyspace_documents(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'classroomLinks') is distinct from 'array' or jsonb_array_length(p_state->'classroomLinks')>50000 then raise exception 'INVALID_COLLECTION: classroomLinks';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'classroomLinks') loop
 insert into public.studyspace_classroom_links(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if jsonb_typeof(p_state->'classroomItems') is distinct from 'array' or jsonb_array_length(p_state->'classroomItems')>50000 then raise exception 'INVALID_COLLECTION: classroomItems';end if;
 n:=0; for item in select value from jsonb_array_elements(p_state->'classroomItems') loop
 insert into public.studyspace_classroom_items(owner_id,id,payload,ordinal) values(auth.uid(),item->>'id',item,n);n:=n+1;
 end loop;
if p_state->'activeTimer' is not null and p_state->'activeTimer'<>'null'::jsonb then insert into public.studyspace_timers(owner_id,id,payload) values(auth.uid(),p_state->'activeTimer'->>'id',p_state->'activeTimer');end if;
for p in select value from jsonb_array_elements(p_state->'plans') loop
 for tid in select value from jsonb_array_elements(p->'topicIds') loop
 insert into public.studyspace_plan_topics(owner_id,plan_id,topic_id) values(auth.uid(),p->>'id',tid#>>'{}');end loop;end loop;
 -- Detect folder cycles and invalid topic hierarchies server-side as well.
 if exists(with recursive chain as (
 select id,parent_id,array[id] as path,false as cycle from public.studyspace_folders where owner_id=auth.uid()
 union all select f.id,f.parent_id,c.path||f.id,f.id=any(c.path) from chain c join public.studyspace_folders f on f.owner_id=auth.uid() and f.id=c.parent_id where not c.cycle
 ) select 1 from chain where cycle) then raise exception 'FOLDER_CYCLE';end if;
 if exists(select 1 from public.studyspace_topics t join public.studyspace_topics p on p.owner_id=t.owner_id and p.id=t.parent_id where t.owner_id=auth.uid() and (p.parent_id is not null or p.unit_id<>t.unit_id or p.id=t.id)) then raise exception 'TOPIC_HIERARCHY';end if;
 if exists(select 1 from public.studyspace_plan_topics pt join public.studyspace_plans p on p.owner_id=pt.owner_id and p.id=pt.plan_id join public.studyspace_topics t on t.owner_id=pt.owner_id and t.id=pt.topic_id join public.studyspace_units u on u.owner_id=t.owner_id and u.id=t.unit_id where pt.owner_id=auth.uid() and p.course_id is distinct from u.course_id) then raise exception 'PLAN_TOPIC_COURSE';end if;
 if exists(select 1 from public.studyspace_documents d join public.studyspace_topics t on t.owner_id=d.owner_id and t.id=d.topic_id join public.studyspace_units u on u.owner_id=t.owner_id and u.id=t.unit_id where d.owner_id=auth.uid() and d.course_id is distinct from u.course_id) then raise exception 'DOCUMENT_TOPIC_COURSE';end if;
 if exists(with records as (select owner_id,course_id,topic_id,plan_id from public.studyspace_scheduled_sessions union all select owner_id,course_id,topic_id,plan_id from public.studyspace_study_logs union all select owner_id,course_id,topic_id,plan_id from public.studyspace_timers) select 1 from records r left join public.studyspace_topics t on t.owner_id=r.owner_id and t.id=r.topic_id left join public.studyspace_units u on u.owner_id=t.owner_id and u.id=t.unit_id left join public.studyspace_plans p on p.owner_id=r.owner_id and p.id=r.plan_id where r.owner_id=auth.uid() and ((r.topic_id is not null and r.course_id is distinct from u.course_id) or (r.plan_id is not null and r.course_id is distinct from p.course_id))) then raise exception 'STUDY_COURSE_RELATION';end if;
 update public.studyspace_workspaces set revision=current_revision+1,mutation_id=p_mutation_id,settings=p_state->'settings',study_preferences=p_state->'studyPreferences',integration_preferences=p_state->'integrationPreferences',updated_at=now() where owner_id=auth.uid();
 set constraints all immediate;
 return public.studyspace_read();
end $$;
revoke all on function public.studyspace_read() from public,anon;
revoke all on function public.studyspace_save(jsonb,bigint,text) from public,anon;
grant execute on function public.studyspace_read() to authenticated;
grant execute on function public.studyspace_save(jsonb,bigint,text) to authenticated;
commit;
