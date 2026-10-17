insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ace-vault','ace-vault',false, 209715200, array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm','application/pdf'])
on conflict (id) do nothing;

create table if not exists ace_v2.vault_assets (
  id bigserial primary key,
  category text not null check (category in ('brand','lead_generator','prospecting_os','social_os','customer_acq_os','growth_os','a_la_carte','add_ons','specialist_command','ads_campaigns','ace_baby','website','other')),
  title text not null check (length(title) between 2 and 160),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  tags text[] not null default '{}',
  status text not null default 'saved' check (status in ('saved','approved','archived')),
  source text not null default 'Jim',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_assets_cat_idx on ace_v2.vault_assets(category, status, created_at desc);
alter table ace_v2.vault_assets enable row level security;
revoke all on ace_v2.vault_assets from anon, authenticated;

create or replace function public.owner_vault_list(p_category text default null)
returns jsonb language plpgsql stable security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,
    'counts', coalesce((select jsonb_object_agg(category,n) from (select category,count(*) n from ace_v2.vault_assets where status<>'archived' group by 1) c),'{}'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
      select id,category,title,storage_path,mime_type,size_bytes,tags,status,source,notes,created_at from ace_v2.vault_assets
      where status<>'archived' and (p_category is null or category=p_category) order by created_at desc limit 300) a),'[]'::jsonb));
end $$;

create or replace function public.owner_vault_add(p_category text, p_title text, p_path text, p_mime text, p_size bigint, p_tags text[] default '{}', p_notes text default null)
returns jsonb language plpgsql security definer set search_path to 'ace_v2','public' as $$
declare v_id bigint;
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  if p_path not like 'vault/%' then return jsonb_build_object('ok',false,'error','bad_path'); end if;
  insert into ace_v2.vault_assets(category,title,storage_path,mime_type,size_bytes,tags,notes,source)
  values (p_category,p_title,p_path,p_mime,p_size,coalesce(p_tags,'{}'),p_notes,'Jim') returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;

create or replace function public.owner_vault_update(p_id bigint, p_category text default null, p_title text default null, p_status text default null)
returns jsonb language plpgsql security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  update ace_v2.vault_assets set category=coalesce(p_category,category), title=coalesce(p_title,title), status=coalesce(p_status,status), updated_at=now() where id=p_id;
  return jsonb_build_object('ok',found);
end $$;
grant execute on function public.owner_vault_list(text), public.owner_vault_add(text,text,text,text,bigint,text[],text), public.owner_vault_update(bigint,text,text,text) to authenticated;

-- agents (ChatGPT/Claude via service role or n8n Postgres) register files they upload
create or replace function ace_v2.vault_register(p_category text, p_title text, p_path text, p_mime text, p_size bigint, p_tags text[], p_source text, p_notes text default null)
returns bigint language sql security definer set search_path to 'ace_v2','public' as $$
  insert into ace_v2.vault_assets(category,title,storage_path,mime_type,size_bytes,tags,source,notes)
  values (p_category,p_title,p_path,p_mime,p_size,coalesce(p_tags,'{}'),p_source,p_notes)
  on conflict (storage_path) do update set title=excluded.title, category=excluded.category, updated_at=now()
  returning id;
$$;
revoke all on function ace_v2.vault_register(text,text,text,text,bigint,text[],text,text) from public, anon, authenticated;
grant execute on function ace_v2.vault_register(text,text,text,text,bigint,text[],text,text) to service_role;

drop policy if exists "ace vault owner read" on storage.objects;
drop policy if exists "ace vault owner insert" on storage.objects;
drop policy if exists "ace vault owner update" on storage.objects;
create policy "ace vault owner read" on storage.objects for select to authenticated using (bucket_id='ace-vault' and public.owner_is_owner());
create policy "ace vault owner insert" on storage.objects for insert to authenticated with check (bucket_id='ace-vault' and public.owner_is_owner() and name like 'vault/%');
create policy "ace vault owner update" on storage.objects for update to authenticated using (bucket_id='ace-vault' and public.owner_is_owner());

create table if not exists ace_v2.opportunity_launch_plan (
  id bigserial primary key,
  opportunity_key text not null,
  phase_no int not null,
  phase text not null,
  window_start date, window_end date,
  deliverables text not null,
  exit_gate text not null,
  owner text not null,
  status text not null default 'PLANNED' check (status in ('PLANNED','ACTIVE','DONE','BLOCKED','HELD')),
  created_at timestamptz not null default now(),
  unique (opportunity_key, phase_no)
);
alter table ace_v2.opportunity_launch_plan enable row level security;
revoke all on ace_v2.opportunity_launch_plan from anon, authenticated;

insert into ace_v2.opportunity_launch_plan(opportunity_key,phase_no,phase,window_start,window_end,deliverables,exit_gate,owner,status) values
('AUTHORITY_AI_ULTIMATE_SKILL_COLLECTION_20261017',1,'Brand + messaging drafts','2026-10-17','2026-10-20','ACE Specialist Command positioning, draft copy, first branded image set (silver / dark red / white / black / golden-hour gold, ACE logo) saved to the Marketing Vault under Specialist Command. Draft only; nothing published.','Jim approves the messaging and at least one image set in the Command Center','ChatGPT (copy, images) + Claude (vault, drafts)','ACTIVE'),
('AUTHORITY_AI_ULTIMATE_SKILL_COLLECTION_20261017',2,'Website copy alignment','2026-10-21','2026-10-27','Every current ACE capability mapped to one customer challenge, one simple ACE response, one defensible value; unproven items marked IN DEVELOPMENT. Claude prepares the site change as a PR.','Launch stable for 7 days (no P0 alerts); Jim merges the website PR','ChatGPT (copy) + Claude (site PR)','PLANNED'),
('AUTHORITY_AI_ULTIMATE_SKILL_COLLECTION_20261017',3,'Build five original specialists','2026-10-28','2026-11-15','Growth Intelligence, Content & Campaigns, Sales & Proposals, Operations, Evidence & Quality, built as original ACE IP inside the existing Draft Center / Academy architecture. No copying or redistributing third-party skill files.','Each specialist passes an evidence check (accuracy, cost per run, time saved) on ACE''s own work','Claude (build) + ChatGPT (QA)','PLANNED'),
('AUTHORITY_AI_ULTIMATE_SKILL_COLLECTION_20261017',4,'Customer-zero pilot (ACE itself)','2026-11-16','2026-12-09','Run the specialists on ACE''s own marketing and sales; record accuracy, interventions, cost, time saved and evidence receipts in the Command Center.','Independent verification of pilot receipts; Jim reviews results','Claude + ChatGPT; Jim reviews','PLANNED'),
('AUTHORITY_AI_ULTIMATE_SKILL_COLLECTION_20261017',5,'Limited beta + pricing','2026-12-10','2027-01-31','Small paid beta, support readiness, approved pricing and checkout. Marketing posts from the vault go live only after approval.','Jim approves price and authorizes launch','Jim (decision); Claude (checkout, campaigns)','HELD')
on conflict (opportunity_key, phase_no) do nothing;

create or replace function public.owner_opportunity_plan(p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'ace_v2','public' as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,'phases',coalesce((select jsonb_agg(to_jsonb(p) order by phase_no) from ace_v2.opportunity_launch_plan p where opportunity_key=p_key),'[]'::jsonb));
end $$;
grant execute on function public.owner_opportunity_plan(text) to authenticated;

select 'vault ok' r, (select count(*) from storage.buckets where id='ace-vault') buckets, (select count(*) from ace_v2.opportunity_launch_plan) phases;

-- v1.1: post a vault asset to IG/FB/YouTube. Creates a PENDING owner_drafts row only;
-- approval still happens through owner_decide_draft under the owner's own session.
create or replace function public.owner_vault_to_post(p_asset_id bigint, p_caption text, p_channels text, p_media_url text)
returns jsonb language plpgsql security definer set search_path to 'ace_v2','public' as $$
declare a ace_v2.vault_assets; v_id bigint; v_kind text; v_ch text;
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  select * into a from ace_v2.vault_assets where id=p_asset_id;
  if not found then return jsonb_build_object('ok',false,'error','no_asset'); end if;
  if p_media_url !~ '^https://' then return jsonb_build_object('ok',false,'error','bad_media_url'); end if;
  if coalesce(trim(p_caption),'')='' then return jsonb_build_object('ok',false,'error','caption_required'); end if;
  select string_agg(c, ',') into v_ch from (select distinct lower(trim(x)) c from unnest(string_to_array(p_channels, ',')) x where lower(trim(x)) in ('instagram','facebook','youtube')) s;
  if v_ch is null then return jsonb_build_object('ok',false,'error','no_channel'); end if;
  v_kind := case when coalesce(a.mime_type,'') like 'video/%' or a.storage_path ~* '\.(mp4|mov|webm)$' then 'video' else 'ad_post' end;
  insert into ace_v2.owner_drafts(source,kind,channel,title,body,media_url,ref,stage,status)
  values ('Jim',v_kind,v_ch,a.title,p_caption,p_media_url,'VAULT-'||a.id,'final','PENDING') returning id into v_id;
  return jsonb_build_object('ok',true,'draft_id',v_id);
end $$;
grant execute on function public.owner_vault_to_post(bigint,text,text,text) to authenticated;
