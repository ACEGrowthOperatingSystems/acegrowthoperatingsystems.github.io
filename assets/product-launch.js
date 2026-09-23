(()=>{"use strict";

const RELEASE_AUTHORIZED=false;
const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";

const PREVIEW_MESSAGE="Preview verified. Submission is held until launch authorization; nothing was sent.";
const HELD_SUCCESS_MESSAGE="Thank you. Your request was received for internal review. It remains unqualified and untagged. No outreach or other external action has been authorized.";
const FAILURE_MESSAGE="We could not safely confirm that your request was held for review. Please try again later.";

const bytesToHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const sha256=async value=>bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const solveProof=async payload=>{
  const challenge=`${payload.idempotency_key}:${payload.submitted_at}:${payload.interaction_started_at}:`;
  for(let nonce=0;nonce<=2000000;nonce++){
    const digest=await sha256(challenge+nonce);
    if(digest.startsWith("000"))return{pow_nonce:nonce,pow_digest:digest};
  }
  throw new Error("BOT_PROOF_UNAVAILABLE");
};

const isStrictHeldReceipt=(receipt,payload)=>Boolean(
  receipt&&
  receipt.ok===true&&
  receipt.accepted===true&&
  receipt.accepted_for_review===true&&
  receipt.action_taken===false&&
  receipt.synthetic===false&&
  receipt.schema_valid===true&&
  receipt.form===payload.form&&
  receipt.qualified===false&&
  receipt.qualification_status==="PENDING"&&
  receipt.consent_recorded===true&&
  receipt.release_state==="APPROVAL_HELD"&&
  receipt.external_action_authorized===false&&
  receipt.tag_mapping_status==="UNRESOLVED"
);

document.querySelectorAll("[data-launch-form]").forEach(form=>{
  const status=form.querySelector("[role=status]");
  const startedAt=new Date().toISOString();
  const botField=document.createElement("input");
  botField.type="text";
  botField.name="bot_field";
  botField.tabIndex=-1;
  botField.autocomplete="off";
  botField.setAttribute("aria-hidden","true");
  botField.style.cssText="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
  form.appendChild(botField);

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;

    const fields=Object.fromEntries(new FormData(form).entries());
    const payload={
      ...fields,
      consent:fields.consent==="on",
      bot_field:String(fields.bot_field||""),
      interaction_started_at:startedAt,
      idempotency_key:crypto.randomUUID(),
      submitted_at:new Date().toISOString(),
      release_state:"APPROVAL_HELD"
    };
    Object.assign(payload,await solveProof(payload));

    if(!RELEASE_AUTHORIZED){
      status.textContent=PREVIEW_MESSAGE;
      form.dataset.lastPayload=JSON.stringify(payload);
      return;
    }

    try{
      const response=await fetch(ENDPOINT,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      if(!response.ok)throw new Error("HTTP_ERROR");

      const receipt=await response.json();
      if(!isStrictHeldReceipt(receipt,payload))throw new Error("INVALID_HELD_RECEIPT");

      status.textContent=HELD_SUCCESS_MESSAGE;
      form.reset();
    }catch(error){
      status.textContent=FAILURE_MESSAGE;
    }
  });
});

})();
