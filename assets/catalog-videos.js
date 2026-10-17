(()=>{"use strict";
// Catalog page: Hannah's walkthrough video for whichever product family tab is
// open (Jim, 17 Oct 2026). Plays in the shared theater player (theater.js).
const V="/assets/video/";
const MAP={
  "tab-alacarte":[2,"À la carte products, with Hannah","0:41"],
  "tab-leadgen":[3,"The ACE Lead Generator, with Hannah","0:33"],
  "tab-os":[4,"Growth Operating Systems, with Hannah","0:34"],
  "tab-topups":[5,"Usage credits and top-ups, with Hannah","0:22"],
  "tab-pricing":[1,"How ACE pricing works, with Hannah","0:39"]
};
const ready=fn=>document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn):fn();
ready(()=>{
  const box=document.getElementById("catVideo");if(!box)return;
  const show=id=>{
    const m=MAP[id]||MAP["tab-alacarte"],n=m[0];
    box.innerHTML='<button class="th-card cat-vcard" type="button" data-video="'+V+'catalog-'+n+'.mp4" data-poster="'+V+'catalog-'+n+'.jpg" data-vtt="'+V+'catalog-'+n+'.vtt" data-title="'+m[1]+'">'
      +'<span class="pic" style="background-image:url(\''+V+'catalog-'+n+'.jpg\')"><span class="dur">'+m[2]+'</span></span>'
      +'<span class="txt"><b>'+m[1]+'</b><small>Hannah’s quick walkthrough. Every price is listed below. <a href="/theater/#catalog">All catalog videos</a></small></span></button>';
  };
  const sel=document.querySelector('#familyTabs [aria-selected="true"]');show(sel?sel.id:"tab-alacarte");
  const tabs=document.getElementById("familyTabs");
  if(tabs)tabs.addEventListener("click",e=>{const t=e.target.closest('[role="tab"]');if(t)setTimeout(()=>show(t.id),0)});
  if(tabs)tabs.addEventListener("keydown",()=>setTimeout(()=>{const s=document.querySelector('#familyTabs [aria-selected="true"]');if(s)show(s.id)},0));
});
})();
