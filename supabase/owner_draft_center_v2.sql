-- Draft Center v2 (Jim 15 Oct): one approval per FINISHED post, post now or schedule.
alter table ace_v2.owner_drafts
  add column if not exists publish_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists publish_result text,
  add column if not exists stage text not null default 'final';

create or replace function ace_v2.owner_drafts_guard() returns trigger
language plpgsql set search_path = ace_v2, public as $$
begin
  if new.status is distinct from old.status or new.publish_at is distinct from old.publish_at then
    if auth.uid() is null or not exists (select 1 from ace_v2.owner_accounts where email = lower(coalesce(auth.jwt()->>'email',''))) then
      raise exception 'owner_drafts: only a signed-in owner can approve or schedule';
    end if;
    new.decided_by := auth.uid(); new.decided_email := lower(auth.jwt()->>'email'); new.decided_at := now();
  end if;
  return new;
end $$;

create or replace function public.owner_list_drafts(p_status text default 'PENDING') returns jsonb
language plpgsql stable security definer set search_path = ace_v2, public as $$
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  return jsonb_build_object('ok',true,
    'counts',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from ace_v2.owner_drafts where media_url is not null or kind in ('outreach','other') group by status) c),'{}'::jsonb),
    'drafts',coalesce((select jsonb_agg(to_jsonb(d) order by d.urgent desc, d.scheduled_for nulls last, d.id) from (
      select id,created_at,source,kind,channel,title,body,media_url,scheduled_for,urgent,ref,batch,status,stage,publish_at,published_at,publish_result,decided_at,owner_comment
      from ace_v2.owner_drafts
      where status = p_status and (media_url is not null or kind in ('outreach','other'))
        and (p_status = 'PENDING' or created_at > now() - interval '30 days')) d),'[]'::jsonb));
end $$;

drop function if exists public.owner_decide_draft(bigint,text,text);
create or replace function public.owner_decide_draft(p_draft_id bigint, p_decision text, p_comment text default null, p_publish_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = ace_v2, public as $$
declare v_n int;
begin
  if not public.owner_is_owner() then return jsonb_build_object('ok',false,'error','not_owner'); end if;
  if p_decision not in ('APPROVED','CHANGE_REQUESTED','REJECTED') then return jsonb_build_object('ok',false,'error','bad_decision'); end if;
  if p_decision = 'CHANGE_REQUESTED' and coalesce(trim(p_comment),'') = '' then return jsonb_build_object('ok',false,'error','comment_required'); end if;
  update ace_v2.owner_drafts
     set status = p_decision, owner_comment = left(p_comment,2000),
         publish_at = case when p_decision = 'APPROVED' and stage = 'final' and kind not in ('outreach','other')
                           then greatest(coalesce(p_publish_at, now()), now()) end
   where id = p_draft_id and status = 'PENDING';
  get diagnostics v_n = row_count;
  if v_n = 1 then
    insert into ace_v2.owner_decision_log(draft_id,decision,comment,user_id,email)
    values (p_draft_id,p_decision || coalesce(' @' || p_publish_at::text,''),left(p_comment,2000),auth.uid(),lower(auth.jwt()->>'email'));
  end if;
  return jsonb_build_object('ok', v_n = 1);
end $$;
revoke all on function public.owner_decide_draft(bigint,text,text,timestamptz) from public, anon;
grant execute on function public.owner_decide_draft(bigint,text,text,timestamptz) to authenticated;

-- First finished post: the approved ACE Baby Cowboy 8-Stage reel (video approved by Jim as v8, 14 Oct).
insert into ace_v2.owner_drafts(source,kind,channel,title,body,media_url,ref,batch,stage,urgent)
values ('Claude','video','instagram,facebook,youtube','ACE Baby · Cowboy 8-Stage reel (v8)','8 stages. One system. Zero chasing. 🤠

ACE answers new leads within minutes, follows up, books calls and schedules your posts, and you approve it all from your phone.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-cowboy-8stage-v8.mp4','5.03','launch-reels','final',true);

select 'Draft Center v2 ready' as result;
