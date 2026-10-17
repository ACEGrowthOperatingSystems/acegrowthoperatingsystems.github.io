create extension if not exists pg_net;

create table if not exists ace_v2.command_items (
  id bigserial primary key,
  project text not null default 'general' check (project in ('alerts','launch','demo_videos','hannah_videos','ace_outreach','withyou_outreach','website','my_ace','agentic','withyou_app','ace_app','general')),
  item_type text not null default 'update' check (item_type in ('alert','task','update')),
  severity text not null default 'info' check (severity in ('P0','P1','info')),
  owner text not null default 'Jim' check (owner in ('Jim','Claude','ChatGPT','Codex')),
  status text not null default 'open' check (status in ('open','done','dismissed')),
  title text not null check (length(title) between 3 and 200),
  body text,
  link text,
  ref text,
  source text not null default 'Claude',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  pushed_at timestamptz,
  push_result text
);
create index if not exists command_items_open_idx on ace_v2.command_items(project, status, created_at desc);
alter table ace_v2.command_items enable row level security;
revoke all on ace_v2.command_items from anon, authenticated;

create or replace function ace_v2.command_post(p_project text, p_type text, p_title text, p_body text default null, p_severity text default 'info', p_owner text default 'Jim', p_link text default null, p_ref text default null, p_source text default 'Claude', p_due timestamptz default null)
returns bigint language plpgsql security definer set search_path to 'ace_v2','public' as $$
declare v_id bigint;
begin
  if p_ref is not null then
    update ace_v2.command_items set title=p_title, body=coalesce(p_body,body), severity=p_severity, link=coalesce(p_link,link)
      where ref=p_ref and project=p_project and status='open' returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into ace_v2.command_items(project,item_type,title,body,severity,owner,link,ref,source,due_at)
  values (p_project,p_type,p_title,p_body,p_severity,p_owner,p_link,p_ref,p_source,p_due) returning id into v_id;
  return v_id;
end $$;
revoke all on function ace_v2.command_post(text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;

create or replace function public.owner_command_list(p_project text default null)
returns jsonb language plpgsql stable security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,
    'counts', coalesce((select jsonb_object_agg(project, n) from (
        select case when item_type='alert' then 'alerts' else project end as project, count(*) n
        from ace_v2.command_items where status='open' and (item_type='alert' or owner='Jim') group by 1) c),'{}'::jsonb),
    'drafts_pending', (select count(*) from ace_v2.owner_drafts where status='PENDING'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by (i.status='open') desc, case i.severity when 'P0' then 0 when 'P1' then 1 else 2 end, i.created_at desc) from (
        select id,project,item_type,severity,owner,status,title,body,link,ref,source,due_at,created_at,done_at
        from ace_v2.command_items
        where (p_project is null)
           or (p_project='alerts' and item_type='alert')
           or (p_project<>'alerts' and project=p_project)
        order by created_at desc limit 200) i),'[]'::jsonb));
end $$;

create or replace function public.owner_command_set(p_id bigint, p_status text)
returns jsonb language plpgsql security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  if p_status not in ('open','done','dismissed') then return jsonb_build_object('ok',false,'error','bad_status'); end if;
  update ace_v2.command_items set status=p_status, done_at=case when p_status='open' then null else now() end where id=p_id;
  return jsonb_build_object('ok',found);
end $$;

create or replace function public.owner_launch_checklist()
returns jsonb language plpgsql stable security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,'items',coalesce((select jsonb_agg(jsonb_build_object('item_id',item_id,'stage',stage_no,'task',task,'owner',owner,'status',status,'committed_date',committed_date) order by stage_no, item_id) from ace_v2.launch_checklist_items),'[]'::jsonb));
end $$;
grant execute on function public.owner_command_list(text), public.owner_command_set(bigint,text), public.owner_launch_checklist() to authenticated;

create or replace function public.owner_command_push_item(p_id bigint)
returns jsonb language sql stable security definer set search_path to 'ace_v2','public' as $$
  select jsonb_build_object('item', (select to_jsonb(i) from ace_v2.command_items i where id=p_id),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint',endpoint,'subscription',subscription)) from ace_v2.owner_push_subscriptions),'[]'::jsonb));
$$;
create or replace function public.owner_command_mark_pushed(p_id bigint, p_result text)
returns void language sql security definer set search_path to 'ace_v2','public' as $$
  update ace_v2.command_items set pushed_at=now(), push_result=left(p_result,300) where id=p_id;
$$;
revoke all on function public.owner_command_push_item(bigint), public.owner_command_mark_pushed(bigint,text) from public, anon, authenticated;

create or replace function ace_v2.command_items_push_trg()
returns trigger language plpgsql security definer set search_path to 'ace_v2','public' as $$
begin
  if (new.item_type='alert' and new.severity in ('P0','P1')) or (new.item_type='task' and new.owner='Jim') then
    perform net.http_post(
      url := 'https://axvcxkcdunxnjhsstopt.supabase.co/functions/v1/owner-push?action=command&id=' || new.id,
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;
  return new;
end $$;
drop trigger if exists command_items_push on ace_v2.command_items;
create trigger command_items_push after insert on ace_v2.command_items for each row execute function ace_v2.command_items_push_trg();

select 'ok' as result, (select count(*) from ace_v2.command_items) as items;

-- applied after v1: service role needs these for the owner-push edge function and agents
grant execute on function public.owner_command_push_item(bigint), public.owner_command_mark_pushed(bigint,text) to service_role;
grant execute on function ace_v2.command_post(text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
