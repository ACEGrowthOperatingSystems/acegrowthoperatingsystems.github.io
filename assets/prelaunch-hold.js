(()=>{"use strict";
// Pre-launch hold (Jim, 16 Oct 2026): the public website stays closed until the
// 20 Oct launch. Visitors see a "Launching October 20" screen. Lifts itself at
// 00:00 ET on 20 Oct 2026. "?preview=1" shows the real page for review only.
// The /start/ questionnaire, legal pages, My ACE and the owner console do not
// load this script, so they keep working.
const LAUNCH=Date.parse("2026-10-20T00:00:00-04:00");
let preview=false;try{preview=new URLSearchParams(location.search).get("preview")==="1"}catch(e){}
if(preview||Date.now()>=LAUNCH)return;
const de=document.documentElement;de.style.visibility="hidden";
const paint=()=>{
  document.title="ACE Growth Operating Systems | Launching October 20";
  document.body.innerHTML='<main style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:32px 16px;background:#000;color:#fff;font-family:Arial,Helvetica,sans-serif;text-align:center">'
   +'<img src="/assets/ace-logo.jpg" alt="ACE Growth Operating Systems" width="120" height="120" style="border-radius:12px">'
   +'<h1 style="margin:0;font-size:clamp(28px,6vw,48px);letter-spacing:.02em">Launching October 20</h1>'
   +'<p style="margin:0;max-width:520px;color:#C9CDD2;font-size:18px;line-height:1.5">Stop paying the price for not automating. See ACE in action today with a free 1-minute demo.</p>'
   +'<a href="/start/?src=holding-page" style="background:#e3242b;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;font-size:17px">Get my free demo</a>'
   +'<p style="margin:12px 0 0;color:#949AA2;font-size:13px"><a href="/terms/" style="color:#949AA2">Terms</a> · <a href="/privacy/" style="color:#949AA2">Privacy</a> · AceGrowth.os@gmail.com</p></main>';
  document.body.style.margin="0";document.body.style.background="#000";
  de.style.visibility="visible";
};
if(document.body)paint();else document.addEventListener("DOMContentLoaded",paint);
})();
