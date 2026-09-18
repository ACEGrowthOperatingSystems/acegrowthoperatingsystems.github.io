(()=>{"use strict";

const SUBMISSION_AUTHORIZED=true;
const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";

const PREVIEW_MESSAGE="Preview verified. Submission is held until launch authorization; nothing was sent.";
const HELD_SUCCESS_MESSAGE="Thank you. Your request was received for internal review. It remains unqualified and untagged. No outreach or other external action has been authorized.";
const FAILURE_MESSAGE="We could not safely confirm that your request was held for review. Please try again later.";

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
  // The response contract does not expose notion_tags. UNRESOLVED is the
  // returned proof field for the held product-interest tag state; the active
  // backend graph separately maps this route to notion_tags:[] and blocks the
  // tag/contact branch while external_action_authorized is false.
  receipt.tag_mapping_status==="UNRESOLVED"
);

document.querySelectorAll("[data-launch-form]").forEach(form=>{
  const status=form.querySelector("[role=status]");

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;

    const fields=Object.fromEntries(new FormData(form).entries());
    const payload={
      ...fields,
      consent:fields.consent==="on",
      idempotency_key:crypto.randomUUID(),
      submitted_at:new Date().toISOString(),
      release_state:"APPROVAL_HELD"
    };

    if(!SUBMISSION_AUTHORIZED){
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
