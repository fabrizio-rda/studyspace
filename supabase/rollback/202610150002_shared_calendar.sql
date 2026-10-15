-- Administrator-only rollback of sharing, AFTER exporting sharing metadata.
-- Deletes invitations and relationships only. Never deletes or alters academic data.
begin;
drop function if exists public.studyspace_calendar_feed(date,date);
drop function if exists public.studyspace_calendar_revoke();
drop function if exists public.studyspace_calendar_cancel(uuid);
drop function if exists public.studyspace_calendar_accept(uuid);
drop function if exists public.studyspace_calendar_invite(text);
drop function if exists public.studyspace_calendar_status();
drop table public.studyspace_calendar_members;
drop table public.studyspace_calendar_invites;
drop table public.studyspace_calendar_connections;
commit;
