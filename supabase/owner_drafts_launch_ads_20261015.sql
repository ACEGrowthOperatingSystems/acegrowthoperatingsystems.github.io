-- ACE Draft Center: green-light cleanup + 8 finished ad posts (15 Oct)
-- 1) remove every text-only draft (nothing was decided on them)
delete from ace_v2.owner_drafts where media_url is null and kind not in ('outreach','other') and status = 'PENDING';
-- 2) remove the duplicate Cowboy reel (keeps #50)
delete from ace_v2.owner_drafts where id = 51 and status = 'PENDING';
-- 3) DEMO auto-reply DM points at the website; it returns with the new DEMO flow after Oct 20
delete from ace_v2.owner_drafts where id = 49 and status = 'PENDING';
-- 4) YouTube bio without the website link
update ace_v2.owner_drafts set body = replace(body, ' Want to see ACE in action? Reply DEMO or visit acegrowthoperatingsystems.github.io.', ' Want to see ACE in action? Reply DEMO for a free demo.') where id = 47;
-- 5) the 8 finished Day 1-2 ads (job site, salon, race car text per Jim 15 Oct; race car is now the ACE Indy car still) (suggested times 9am, 12pm, 3pm, 6pm ET; change them when you approve)
insert into ace_v2.owner_drafts(source,kind,channel,title,body,media_url,scheduled_for,batch,stage,urgent) values
('Claude','ad_post','instagram,facebook','Ad · Day 1 · Still waiting hours to answer new leads?','Still waiting hours to answer new leads?

Every minute you wait, your hottest prospects cool off. ACE answers new leads within minutes.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d1a1-office-laptop.jpg','2026-10-16 13:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 1 · Your prospect list is colder than last winter.','Your prospect list is colder than last winter.

ACE builds your prospect lists, so you always have fresh contacts to reach.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d1a2-winter-window.jpg','2026-10-16 16:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 1 · Forgetting to follow up?','Forgetting to follow up?

Missed follow-ups mean lost deals. ACE follows up and books the calls for you.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d1a3-golf-cart.jpg','2026-10-16 19:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 1 · Posting to social whenever you remember?','Posting to social whenever you remember?

ACE schedules your social posts, so your business shows up every time.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d1a4-poolside.jpg','2026-10-16 22:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 2 · Still writing every proposal by hand?','Still writing every proposal by hand?

ACE sends proposals for you. Just approve from your phone.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d2a5-stack-of-papers.jpg','2026-10-17 13:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 2 · Leads slipping through the cracks?','Leads slipping through the cracks?

ACE helps you stay on top of your leads with automation!

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d2a6-job-site.jpg','2026-10-17 16:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 2 · No time to market your business?','No time to market your business?

ACE agents automate outreach!

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://acegrowthoperatingsystems.github.io/media/posts/ace-baby-ad-d2a7-salon.jpg','2026-10-17 19:00+00','launch-ads-d1-2','final',false),
('Claude','ad_post','instagram,facebook','Ad · Day 2 · If you like speed,','If you like speed, put your business in 5th gear and automate your business from anywhere.

Tap Follow
Reply DEMO for a free demo

#ACEBaby #SmallBusinessAutomation #AgenticAutomation','https://awiedneibikvrgjejddo.supabase.co/storage/v1/object/public/ace-social/ace-baby-ad-d2a8-indy-car-v1.jpg','2026-10-17 22:00+00','launch-ads-d1-2','final',false);
select status, count(*) from ace_v2.owner_drafts group by status;
