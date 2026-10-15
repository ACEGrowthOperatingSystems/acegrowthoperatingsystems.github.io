-- Owner Draft Center v1 (ACE project axvcxkcdunxnjhsstopt). Apply once.
-- One approval queue for the owner, separate from customer accounts (My ACE)
-- and from the public site. Nothing here is granted to the anon role.

create table if not exists ace_v2.owner_accounts (
  email text primary key check (email = lower(email)),
  label text,
  created_at timestamptz not null default now()
);
insert into ace_v2.owner_accounts(email,label) values
  ('acegrowth.os@gmail.com','Jim (ACE business email)'),
  ('jimlanieradvisory@live.com','Jim (personal)')
on conflict do nothing;

create table if not exists ace_v2.owner_drafts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null,              -- ChatGPT loop, Claude, Content Machine, PROXIMO...
  kind text not null,                -- ad_post, agentic_post, video_script, video, outreach, offer_copy, demo
  channel text,                      -- instagram, facebook, youtube, email, website
  title text not null,
  body text,
  media_url text,
  scheduled_for timestamptz,
  urgent boolean not null default false,
  ref text,                          -- ledger message / checklist item
  batch text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','CHANGE_REQUESTED','REJECTED')),
  decided_by uuid,
  decided_email text,
  decided_at timestamptz,
  owner_comment text
);
create index if not exists owner_drafts_status_idx on ace_v2.owner_drafts(status, created_at);

create table if not exists ace_v2.owner_decision_log (
  id bigint generated always as identity primary key,
  draft_id bigint not null references ace_v2.owner_drafts(id),
  decision text not null,
  comment text,
  user_id uuid not null,
  email text not null,
  decided_at timestamptz not null default now()
);

create table if not exists ace_v2.owner_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  email text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  last_error text
);
create table if not exists ace_v2.owner_push_keys (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
create table if not exists ace_v2.owner_push_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  pending int, new_since_last int, delivered int, failed int, note text
);

alter table ace_v2.owner_accounts enable row level security;
alter table ace_v2.owner_drafts enable row level security;
alter table ace_v2.owner_decision_log enable row level security;
alter table ace_v2.owner_push_subscriptions enable row level security;
alter table ace_v2.owner_push_keys enable row level security;
alter table ace_v2.owner_push_log enable row level security;
revoke all on ace_v2.owner_accounts, ace_v2.owner_drafts, ace_v2.owner_decision_log,
  ace_v2.owner_push_subscriptions, ace_v2.owner_push_keys, ace_v2.owner_push_log from anon, authenticated;

-- A decision can only be recorded under a signed-in owner's own session.
-- A status change from the SQL editor, a service key or any agent (no auth.uid())
-- is refused, so no one but the owner can mark a draft approved.
create or replace function ace_v2.owner_drafts_guard() returns trigger
language plpgsql set search_path = ace_v2, public as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is null or not exists (
      select 1 from ace_v2.owner_accounts where email = lower(coalesce(auth.jwt()->>'email',''))) then
      raise exception 'owner_drafts: a decision can only be made by a signed-in owner';
    end if;
    new.decided_by := auth.uid();
    new.decided_email := lower(auth.jwt()->>'email');
    new.decided_at := now();
  end if;
  return new;
end $$;
drop trigger if exists owner_drafts_guard on ace_v2.owner_drafts;
create trigger owner_drafts_guard before update on ace_v2.owner_drafts
for each row execute function ace_v2.owner_drafts_guard();

-- ---------- owner (signed-in) RPCs ----------
create or replace function public.owner_is_owner() returns boolean
language sql stable security definer set search_path = ace_v2, public as $$
  select auth.uid() is not null and exists (
    select 1 from ace_v2.owner_accounts where email = lower(coalesce(auth.jwt()->>'email','')));
$$;

create or replace function public.owner_list_drafts(p_status text default 'PENDING') returns jsonb
language plpgsql stable security definer set search_path = ace_v2, public as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,
    'counts',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from ace_v2.owner_drafts group by status) c),'{}'::jsonb),
    'drafts',coalesce((select jsonb_agg(to_jsonb(d) order by d.urgent desc, d.scheduled_for nulls last, d.id)
      from (select id,created_at,source,kind,channel,title,body,media_url,scheduled_for,urgent,ref,batch,status,decided_at,decided_email,owner_comment
            from ace_v2.owner_drafts
            where status = p_status and (p_status = 'PENDING' or created_at > now() - interval '30 days')) d),'[]'::jsonb));
end $$;

create or replace function public.owner_decide_draft(p_draft_id bigint, p_decision text, p_comment text default null) returns jsonb
language plpgsql security definer set search_path = ace_v2, public as $$
declare v_n int;
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  if p_decision not in ('APPROVED','CHANGE_REQUESTED','REJECTED') then
    return jsonb_build_object('ok',false,'error','bad_decision'); end if;
  if p_decision = 'CHANGE_REQUESTED' and coalesce(trim(p_comment),'') = '' then
    return jsonb_build_object('ok',false,'error','comment_required'); end if;
  update ace_v2.owner_drafts set status = p_decision, owner_comment = left(p_comment,2000)
   where id = p_draft_id and status = 'PENDING';
  get diagnostics v_n = row_count;
  if v_n = 1 then
    insert into ace_v2.owner_decision_log(draft_id,decision,comment,user_id,email)
    values (p_draft_id,p_decision,left(p_comment,2000),auth.uid(),lower(auth.jwt()->>'email'));
  end if;
  return jsonb_build_object('ok', v_n = 1);
end $$;

create or replace function public.owner_save_push_subscription(p_sub jsonb, p_ua text default null) returns jsonb
language plpgsql security definer set search_path = ace_v2, public as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  if p_sub->>'endpoint' is null or p_sub->'keys'->>'p256dh' is null or p_sub->'keys'->>'auth' is null then
    return jsonb_build_object('ok',false,'error','bad_subscription'); end if;
  insert into ace_v2.owner_push_subscriptions(endpoint,subscription,email,user_agent)
  values (p_sub->>'endpoint',p_sub,lower(auth.jwt()->>'email'),left(p_ua,300))
  on conflict (endpoint) do update set subscription = excluded.subscription, email = excluded.email,
    user_agent = excluded.user_agent, last_error = null;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.owner_is_owner(), public.owner_list_drafts(text),
  public.owner_decide_draft(bigint,text,text), public.owner_save_push_subscription(jsonb,text) from public, anon;
grant execute on function public.owner_is_owner(), public.owner_list_drafts(text),
  public.owner_decide_draft(bigint,text,text), public.owner_save_push_subscription(jsonb,text) to authenticated;

-- ---------- service-role RPCs (owner-push edge function only) ----------
create or replace function public.owner_push_get_keys() returns jsonb
language sql security definer set search_path = ace_v2, public as $$
  select coalesce((select jsonb_build_object('public_key',public_key,'private_key',private_key) from ace_v2.owner_push_keys where id=1),'{}'::jsonb);
$$;
create or replace function public.owner_push_set_keys(p_public text, p_private text) returns jsonb
language plpgsql security definer set search_path = ace_v2, public as $$
begin
  insert into ace_v2.owner_push_keys(id,public_key,private_key) values (1,p_public,p_private) on conflict (id) do nothing;
  return public.owner_push_get_keys();
end $$;

create or replace function public.owner_push_state(p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = ace_v2, public as $$
declare
  v_pending int; v_urgent int; v_last timestamptz; v_new int; v_subs jsonb; v_should boolean; v_reason text;
begin
  select count(*), count(*) filter (where urgent) into v_pending, v_urgent from ace_v2.owner_drafts where status='PENDING';
  select max(sent_at) into v_last from ace_v2.owner_push_log where delivered > 0;
  select count(*) into v_new from ace_v2.owner_drafts where status='PENDING' and created_at > coalesce(v_last,'epoch');
  select coalesce(jsonb_agg(jsonb_build_object('endpoint',endpoint,'subscription',subscription)),'[]'::jsonb)
    into v_subs from ace_v2.owner_push_subscriptions;
  if jsonb_array_length(v_subs) = 0 then v_should := false; v_reason := 'no_devices';
  elsif p_force then
    v_should := v_last is null or v_last < now() - interval '1 minute'; v_reason := case when v_should then 'test' else 'rate_limited' end;
  elsif v_pending = 0 then v_should := false; v_reason := 'nothing_pending';
  elsif v_new = 0 then v_should := false; v_reason := 'already_alerted';
  elsif v_urgent = 0 and v_last is not null and v_last > now() - interval '20 minutes' then v_should := false; v_reason := 'spacing';
  else v_should := true; v_reason := 'new_drafts';
  end if;
  return jsonb_build_object('should_send',v_should,'reason',v_reason,'pending',v_pending,'urgent',v_urgent,
    'new_since_last',v_new,'subscriptions',case when v_should then v_subs else '[]'::jsonb end);
end $$;

create or replace function public.owner_push_mark(p_endpoint text, p_error text, p_gone boolean default false) returns void
language plpgsql security definer set search_path = ace_v2, public as $$
begin
  if p_gone then delete from ace_v2.owner_push_subscriptions where endpoint = p_endpoint; return; end if;
  update ace_v2.owner_push_subscriptions
     set last_ok_at = case when p_error is null then now() else last_ok_at end, last_error = p_error
   where endpoint = p_endpoint;
end $$;

create or replace function public.owner_push_log_send(p_pending int, p_new int, p_ok int, p_failed int, p_note text) returns void
language sql security definer set search_path = ace_v2, public as $$
  insert into ace_v2.owner_push_log(pending,new_since_last,delivered,failed,note) values (p_pending,p_new,p_ok,p_failed,p_note);
$$;

revoke all on function public.owner_push_get_keys(), public.owner_push_set_keys(text,text), public.owner_push_state(boolean),
  public.owner_push_mark(text,text,boolean), public.owner_push_log_send(int,int,int,int,text) from public, anon, authenticated;
grant execute on function public.owner_push_get_keys(), public.owner_push_set_keys(text,text), public.owner_push_state(boolean),
  public.owner_push_mark(text,text,boolean), public.owner_push_log_send(int,int,int,int,text) to service_role;
