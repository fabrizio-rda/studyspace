-- Additive extension after 202610150001_phase3.sql. No academic rows, IDs or policies are changed.
-- Run as the Supabase project administrator. These RPCs return narrow, authorized projections.
begin;
create table public.studyspace_calendar_connections (
 id uuid primary key default gen_random_uuid(),
 member_a uuid not null references auth.users(id) on delete cascade,
 member_b uuid not null references auth.users(id) on delete cascade,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 check(member_a<>member_b),check(active=(revoked_at is null))
);
create table public.studyspace_calendar_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 connection_id uuid not null references public.studyspace_calendar_connections(id) on delete cascade
);
create index on public.studyspace_calendar_members(connection_id);
create table public.studyspace_calendar_invites (
 id uuid primary key default gen_random_uuid(),
 inviter_id uuid not null references auth.users(id) on delete cascade,
 target_email text not null check(length(target_email) between 3 and 320 and target_email=lower(btrim(target_email))),
 status text not null default 'pending' check(status in ('pending','accepted','revoked','rejected')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_by uuid references auth.users(id) on delete set null,
 check(expires_at>created_at)
);
create index on public.studyspace_calendar_invites(inviter_id,status);
create index on public.studyspace_calendar_invites(target_email,status);
alter table public.studyspace_calendar_connections enable row level security;
alter table public.studyspace_calendar_connections force row level security;
alter table public.studyspace_calendar_members enable row level security;
alter table public.studyspace_calendar_members force row level security;
alter table public.studyspace_calendar_invites enable row level security;
alter table public.studyspace_calendar_invites force row level security;
-- Default deny. Even participants use checked RPCs, never direct sharing-table DML.
revoke all on public.studyspace_calendar_connections,public.studyspace_calendar_members,public.studyspace_calendar_invites from public,anon,authenticated;

create function public.studyspace_calendar_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); mail text; linked jsonb; outgoing jsonb; incoming jsonb;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 select lower(email) into mail from auth.users where id=me and email_confirmed_at is not null;
 if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 select jsonb_build_object('id',c.id,'peerId',peer.owner_id,'peerName',coalesce(peer.settings->>'name','Cuenta vinculada'),'peerEmail',(select email from auth.users where id=peer.owner_id),'peerAccent',case when peer.settings->>'calendarAccent'='pink' then 'pink' else 'blue' end)
 into linked from public.studyspace_calendar_members m join public.studyspace_calendar_connections c on c.id=m.connection_id and c.active
 join public.studyspace_workspaces peer on peer.owner_id=case when c.member_a=me then c.member_b else c.member_a end
 where m.user_id=me and (c.member_a=me or c.member_b=me);
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.target_email,'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,'expiresAt',i.expires_at) order by i.created_at desc),'[]'::jsonb)
 into outgoing from (select * from public.studyspace_calendar_invites where inviter_id=me order by created_at desc limit 20) i;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'fromName',coalesce(w.settings->>'name','Estudiante'),'fromEmail',(select email from auth.users where id=i.inviter_id),'expiresAt',i.expires_at) order by i.created_at desc),'[]'::jsonb)
 into incoming from public.studyspace_calendar_invites i join public.studyspace_workspaces w on w.owner_id=i.inviter_id where i.target_email=mail and i.status='pending' and i.expires_at>now() and i.inviter_id<>me;
 return jsonb_build_object('connection',linked,'outgoing',outgoing,'incoming',incoming);
end $$;

create function public.studyspace_calendar_invite(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); mail text; target text:=lower(btrim(p_email)); invitation uuid;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 select lower(email) into mail from auth.users where id=me and email_confirmed_at is not null;
 if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 if target is null or length(target)>320 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or target=mail then raise exception 'INVALID_RECIPIENT';end if;
 if not exists(select 1 from public.studyspace_workspaces where owner_id=me and revision>0) then raise exception 'INITIALIZE_ACCOUNT_FIRST';end if;
 perform pg_advisory_xact_lock(hashtextextended('studyspace:calendar:relationships',0));
 if exists(select 1 from public.studyspace_calendar_members where user_id=me) then raise exception 'ALREADY_LINKED';end if;
 select id into invitation from public.studyspace_calendar_invites where inviter_id=me and target_email=target and status='pending' and expires_at>now() order by created_at desc limit 1;
 if invitation is null then
  if (select count(*) from public.studyspace_calendar_invites where inviter_id=me and status='pending' and expires_at>now())>=5 then raise exception 'INVITE_LIMIT';end if;
  insert into public.studyspace_calendar_invites(inviter_id,target_email) values(me,target) returning id into invitation;
 end if;
 return jsonb_build_object('id',invitation);
end $$;

create function public.studyspace_calendar_accept(p_invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); mail text; invitation public.studyspace_calendar_invites; linked uuid;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 select lower(email) into mail from auth.users where id=me and email_confirmed_at is not null;
 if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('studyspace:calendar:relationships',0));
 select * into invitation from public.studyspace_calendar_invites where id=p_invite_id and target_email=mail and inviter_id<>me for update;
 if not found or invitation.expires_at<=now() or invitation.status not in ('pending','accepted') then raise exception 'INVITE_NOT_AVAILABLE';end if;
 if invitation.status='accepted' and invitation.accepted_by=me then return public.studyspace_calendar_status();end if;
 if not exists(select 1 from public.studyspace_workspaces where owner_id=me and revision>0) then raise exception 'INITIALIZE_ACCOUNT_FIRST';end if;
 if exists(select 1 from public.studyspace_calendar_members where user_id in (me,invitation.inviter_id)) then raise exception 'ALREADY_LINKED';end if;
 insert into public.studyspace_calendar_connections(member_a,member_b) values(invitation.inviter_id,me) returning id into linked;
 insert into public.studyspace_calendar_members(user_id,connection_id) values(me,linked),(invitation.inviter_id,linked);
 update public.studyspace_calendar_invites set status='accepted',accepted_by=me where id=p_invite_id;
 update public.studyspace_calendar_invites set status='revoked' where status='pending' and inviter_id in (me,invitation.inviter_id);
 return public.studyspace_calendar_status();
end $$;

create function public.studyspace_calendar_cancel(p_invite_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();mail text;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 select lower(email) into mail from auth.users where id=me and email_confirmed_at is not null;
 if mail is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('studyspace:calendar:relationships',0));
 update public.studyspace_calendar_invites set status=case when inviter_id=me then 'revoked' else 'rejected' end
 where id=p_invite_id and status='pending' and (inviter_id=me or target_email=mail);
 if not found then raise exception 'INVITE_NOT_AVAILABLE';end if;
 return public.studyspace_calendar_status();
end $$;

create function public.studyspace_calendar_revoke() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();linked uuid;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('studyspace:calendar:relationships',0));
 select m.connection_id into linked from public.studyspace_calendar_members m join public.studyspace_calendar_connections c on c.id=m.connection_id and c.active where m.user_id=me and me in(c.member_a,c.member_b);
 if linked is not null then
  update public.studyspace_calendar_connections set active=false,revoked_at=now() where id=linked;
  delete from public.studyspace_calendar_members where connection_id=linked;
 end if;
 return public.studyspace_calendar_status();
end $$;

create function public.studyspace_calendar_feed(p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); linked public.studyspace_calendar_connections; result jsonb;
begin
 if me is null then raise exception 'AUTH_REQUIRED';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>93 then raise exception 'INVALID_RANGE';end if;
 select c.* into linked from public.studyspace_calendar_members m join public.studyspace_calendar_connections c on c.id=m.connection_id and c.active where m.user_id=me and me in(c.member_a,c.member_b);
 if not found then return jsonb_build_object('connected',false,'events','[]'::jsonb);end if;
 with records as (
 select owner_id,id,'task'::text as kind,payload->>'dueDate' as day,payload->>'time' as at_time,payload->>'title' as title,payload->>'type' as activity_type,course_id,payload->>'visibility' as visibility,null::int as minutes from public.studyspace_tasks
 union all select owner_id,id,'event',payload->>'date',payload->>'time',payload->>'title',payload->>'type',course_id,payload->>'visibility',null::int from public.studyspace_events
 union all select owner_id,id,'session',payload->>'date',payload->>'time',payload->>'title',case when payload->>'kind'='review' then 'review' else 'study' end,course_id,payload->>'visibility',(payload->>'minutes')::int from public.studyspace_scheduled_sessions where payload->>'status'<>'cancelled'
 ), authorized as (
 select r.*,w.settings,c.payload as course,
 (r.owner_id=me or r.visibility='details') as details
 from records r join public.studyspace_workspaces w on w.owner_id=r.owner_id
 left join public.studyspace_courses c on c.owner_id=r.owner_id and c.id=r.course_id
 where r.owner_id in(linked.member_a,linked.member_b) and (r.owner_id=me or r.visibility in('busy','details'))
 and r.day<>'' and r.day between (p_start-2)::text and (p_end+2)::text
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',encode(sha256(convert_to(owner_id::text||':'||kind||':'||id,'UTF8')),'hex'),
 'ownerId',owner_id,'ownerName',coalesce(settings->>'name','Estudiante'),
 'ownerAccent',case when settings->>'calendarAccent'='pink' then 'pink' else 'blue' end,
 'sourceTimezone',coalesce(settings->>'timezone','America/Lima'),
 'date',day,'time',coalesce(at_time,''),'minutes',minutes,
 'title',case when details then title else 'Ocupado' end,
 'courseName',case when details then course->>'name' else null end,
 'courseColor',case when details then course->>'color' else null end,
 'type',case when details then activity_type else 'busy' end,
 'kind',case when details then kind else 'busy' end,
 'visibility',case when owner_id=me then coalesce(visibility,'private') else visibility end,
 'own',owner_id=me) order by day,at_time,owner_id,id),'[]'::jsonb) into result from authorized;
 return jsonb_build_object('connected',true,'events',result);
end $$;
-- Functions run with fixed search_path and explicit auth checks. Their only peer read is the projection above.
revoke all on function public.studyspace_calendar_status(),public.studyspace_calendar_invite(text),public.studyspace_calendar_accept(uuid),public.studyspace_calendar_cancel(uuid),public.studyspace_calendar_revoke(),public.studyspace_calendar_feed(date,date) from public,anon;
grant execute on function public.studyspace_calendar_status(),public.studyspace_calendar_invite(text),public.studyspace_calendar_accept(uuid),public.studyspace_calendar_cancel(uuid),public.studyspace_calendar_revoke(),public.studyspace_calendar_feed(date,date) to authenticated;
commit;
