(()=>{"use strict";
// Shared video player for the Product Theater, the Agentic Theater and the
// catalog page. Any button with data-video="<mp4>" opens it in a dialog.
// Optional: data-poster, data-vtt (captions), data-title, data-portrait.
// No network calls beyond the video files themselves.
const ready=fn=>document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn):fn();
ready(()=>{
  const dlg=document.createElement("dialog");dlg.className="th-dialog";dlg.setAttribute("aria-label","Video");
  dlg.innerHTML='<video controls playsinline preload="none"></video><div class="bar"><b></b><button class="button" type="button">Close</button></div>';
  document.body.appendChild(dlg);
  const v=dlg.querySelector("video"),title=dlg.querySelector("b");
  const close=()=>{try{v.pause()}catch(e){}dlg.close()};
  dlg.querySelector("button").addEventListener("click",close);
  dlg.addEventListener("click",e=>{if(e.target===dlg)close()});
  dlg.addEventListener("close",()=>{try{v.pause()}catch(e){}v.removeAttribute("src");v.querySelectorAll("track").forEach(t=>t.remove());v.load()});
  document.addEventListener("click",e=>{
    const b=e.target.closest&&e.target.closest("[data-video]");if(!b)return;
    e.preventDefault();
    v.querySelectorAll("track").forEach(t=>t.remove());
    if(b.dataset.vtt){const t=document.createElement("track");t.kind="captions";t.label="English";t.srclang="en";t.src=b.dataset.vtt;v.appendChild(t)}
    v.src=b.dataset.video;v.poster=b.dataset.poster||"";
    title.textContent=b.dataset.title||"";
    dlg.classList.toggle("portrait","portrait" in b.dataset);
    if(typeof dlg.showModal==="function")dlg.showModal();else dlg.setAttribute("open","");
    const p=v.play();if(p&&p.catch)p.catch(()=>{});
  });
});
})();
