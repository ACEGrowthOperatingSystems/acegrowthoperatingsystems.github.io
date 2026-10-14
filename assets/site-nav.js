(()=>{"use strict";

// ============================================================================
// ACE SITE NAVIGATION: menu to the LEFT of the ACE logo + a Checkout button at
// the TOP RIGHT of every page (Jim, website direction, 12 Oct 2026).
//
// NAV_RELEASE_STATE is this component's own release flag, separate from every
// page's <body data-release-state>. It does not release any page.
//   - anything other than the exact string "RELEASED" is HELD;
//   - HELD: nothing is added to the page (no menu, no Checkout button);
//   - "?preview=1" on the URL shows the held nav for review screenshots only.
// To release: change "APPROVAL_HELD" to "RELEASED" and change nothing else.
// Release it only together with (or after) /catalog/, because Checkout and
// most menu links point at held pages.
//
// No prices, no payment links, no network calls live here.
// ============================================================================

const NAV_RELEASE_STATE="APPROVAL_HELD";

const LINKS=[
  ["Home","/"],
  ["Choose your demo","/#choose-demo"],
  ["Product catalog","/catalog/"],
  ["How pricing works","/catalog/#pricing"],
  ["Get a customized demo","/start/"],
  ["My ACE","/my-ace/"],
  ["Terms","/terms/"],
  ["Refund policy","/refund/"],
  ["Privacy","/privacy/"]
];
const CHECKOUT_HREF="/catalog/#plans";

const w=typeof window!=="undefined"?window:{};
const released=NAV_RELEASE_STATE==="RELEASED";
let preview=false;
try{preview=new URLSearchParams((w.location&&w.location.search)||"").get("preview")==="1";}catch(e){preview=false;}
const show=released||preview;

w.ACE_SITE_NAV=Object.freeze({state:NAV_RELEASE_STATE,released,preview,shown:show,links:LINKS.map(l=>l.slice()),checkoutHref:CHECKOUT_HREF});
if(!show||typeof document==="undefined")return;

const CSS=`
.acenav-menu{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin-right:10px;
  border:1px solid rgba(192,192,192,.5);border-radius:10px;background:#0b0b0b;color:#e6e6e6;cursor:pointer;flex:0 0 auto;vertical-align:middle}
.acenav-menu:focus-visible,.acenav-checkout:focus-visible,.acenav-panel a:focus-visible{outline:2px solid #e10600;outline-offset:2px}
.acenav-menu span,.acenav-menu span::before,.acenav-menu span::after{display:block;width:18px;height:2px;background:currentColor;position:relative;content:""}
.acenav-menu span::before{position:absolute;top:-6px}.acenav-menu span::after{position:absolute;top:6px}
.acenav-panel{position:fixed;top:64px;left:12px;z-index:1001;min-width:220px;max-width:calc(100vw - 24px);padding:8px;
  background:#0b0b0b;border:1px solid rgba(192,192,192,.4);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5)}
.acenav-panel[hidden]{display:none}
.acenav-panel a{display:block;padding:10px 12px;border-radius:8px;color:#e6e6e6;text-decoration:none;font:500 15px/1.3 "IBM Plex Sans",system-ui,sans-serif}
.acenav-panel a:hover{background:#1a1a1a}
.acenav-checkout{position:fixed;top:12px;right:12px;z-index:1000;display:inline-flex;align-items:center;min-height:44px;padding:0 18px;
  border-radius:999px;background:#e10600;color:#fff;text-decoration:none;font:700 15px/1 "Archivo","IBM Plex Sans",system-ui,sans-serif;
  letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.acenav-checkout:hover{background:#b80500}
.acenav-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.acenav-checkout.acenav-inline{position:static;box-shadow:none}
@media (max-width:640px){.acenav-checkout{padding:0 14px;font-size:14px}}
.acenav-preview{position:fixed;bottom:8px;left:8px;z-index:1002;padding:4px 8px;border-radius:6px;background:#333;color:#ffd84d;font:600 12px/1.2 monospace}
`;

const add=()=>{
  if(document.getElementById("acenavPanel"))return;
  const style=document.createElement("style");style.textContent=CSS;document.head.appendChild(style);

  // Menu button, placed immediately before the logo inside the page header.
  const header=document.querySelector("header");
  const logo=header&&(header.querySelector("a.mark,a.logo")||header.querySelector("a img")&&header.querySelector("a img").closest("a"));
  const btn=document.createElement("button");
  btn.type="button";btn.className="acenav-menu";btn.setAttribute("aria-label","Menu");
  btn.setAttribute("aria-expanded","false");btn.setAttribute("aria-controls","acenavPanel");
  btn.appendChild(document.createElement("span"));
  const panel=document.createElement("nav");
  panel.id="acenavPanel";panel.className="acenav-panel";panel.setAttribute("aria-label","Site");panel.hidden=true;
  LINKS.forEach(([label,href])=>{const a=document.createElement("a");a.href=href;a.textContent=label;panel.appendChild(a);});
  const bar=logo&&logo.parentNode;
  let flex=false;
  try{
    if(bar&&bar!==document.body){
      const cs=getComputedStyle(bar);
      flex=cs.display.indexOf("flex")>-1;
      // Left-aligned block header (terms, refund, privacy): make that one row
      // a flex row so the menu sits inline, left of the logo.
      if(!flex&&cs.textAlign!=="center"&&getComputedStyle(header).textAlign!=="center"){
        bar.style.display="flex";bar.style.alignItems="center";flex=true;
      }
    }
  }catch(e){flex=false;}
  // Flex header row (homepage, catalog): the menu sits in the row, left of the
  // logo. Centered headers (start, checkout, terms): pinned at top left, which
  // is still left of the logo and never pushes the logo down.
  if(flex){bar.insertBefore(btn,logo);}
  else{btn.style.position="fixed";btn.style.top="12px";btn.style.left="12px";btn.style.zIndex="1000";document.body.appendChild(btn);}
  document.body.appendChild(panel);

  const close=()=>{panel.hidden=true;btn.setAttribute("aria-expanded","false");};
  btn.addEventListener("click",()=>{const open=panel.hidden;panel.hidden=!open;btn.setAttribute("aria-expanded",String(open));
    if(open){const f=panel.querySelector("a");if(f)f.focus();}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){close();btn.focus();}});
  document.addEventListener("click",e=>{if(!panel.hidden&&!panel.contains(e.target)&&!btn.contains(e.target))close();});

  // Checkout, top right on every page. Leads to the catalog, where each price
  // has its own Add to cart; payment opens only from there, and only when the
  // catalog page and that plan's live link are both released.
  // A page that already has its own Checkout (the catalog) keeps its own.
  if(!document.querySelector(".cat-checkout")){
    const co=document.createElement("a");
    co.className="acenav-checkout";co.href=CHECKOUT_HREF;co.textContent="Checkout";
    if(flex){
      // Flex header bar (homepage): keep the bar's own right-hand links and
      // put Checkout at the far right of the same row.
      const right=document.createElement("span");right.className="acenav-right";
      let n=logo.nextSibling;
      while(n){const next=n.nextSibling;right.appendChild(n);n=next;}
      co.classList.add("acenav-inline");right.appendChild(co);bar.appendChild(right);
    }else{
      document.body.appendChild(co);
    }
  }

  if(!released){const p=document.createElement("div");p.className="acenav-preview";p.textContent="PREVIEW: navigation held";document.body.appendChild(p);}
};

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add);else add();
})();
