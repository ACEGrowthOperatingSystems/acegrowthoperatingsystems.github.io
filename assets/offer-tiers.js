(()=>{"use strict";
// Offer pages: a tier's "Reserve" button pre-selects that tier in the reserve form.
// No network I/O here; submission and its release gate stay in product-launch.js.
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-tier]");if(!b)return;
  const sel=document.querySelector('#reserve select[name="need"]');
  if(sel)sel.value=b.dataset.tier;
});
})();
