// TradeIt trading application; loaded after desktop.js and forms.js.
const tradeDate=value=>value?new Date(value).toLocaleString():'';
const tradeError=error=>error?.message||'Something went wrong. Please try again.';
async function tradeUser(){if(!tradeitDb)throw Error('Database is still connecting. Please reload.');const id=await currentUserId();if(!id)throw Error('Sign in to use Trade Inbox.');return id}
async function offer(item){
  try{
    const uid=await tradeUser();
    if(!item.ownerId)throw Error('Sample listings are demonstrations and cannot receive offers.');
    if(item.ownerId===uid)throw Error('You cannot offer a trade for your own item.');
    const {data,error}=await tradeitDb.from('listings').select('id,title').eq('user_id',uid).eq('status','available').order('created_at',{ascending:false});
    if(error)throw error;
    if(!data?.length)throw Error('Upload one of your own items first, then make an offer.');
    $('#modal').dataset.title='Propose a trade — tradeit';
    modal(`<h2>Offer an item</h2><p>Trade one of your listings for <strong>${esc(item.title)}</strong>.</p><form id="realOfferForm"><label>Your item<select name="offered" required>${data.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label><label>Message (optional)<textarea name="message" maxlength="2000" placeholder="Introduce your offer..."></textarea></label><button class="primary">Send trade offer</button><p id="tradeOfferError" role="status"></p></form>`);
    $('#realOfferForm').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
      try{
        const offered=form.elements.offered.value;
        const {data:tradeId,error:offerError}=await tradeitDb.rpc('propose_trade',{p_offered_listing_id:offered,p_requested_listing_id:item.id});
        if(offerError)throw offerError;
        const msg=form.elements.message.value.trim();
        if(msg){const {error:msgError}=await tradeitDb.from('trade_messages').insert({trade_id:tradeId,sender_id:uid,body:msg});if(msgError)toast('Offer sent, but the introductory message failed: '+tradeError(msgError))}
        $('#modal').close();toast('Trade offer sent!');openTradeInbox();
      }catch(err){$('#tradeOfferError').textContent=tradeError(err)}finally{button.disabled=false}
    };
  }catch(err){toast(tradeError(err))}
}
function openTradeInbox(){
  const w=createWindow('trade-inbox','Trade Inbox — tradeit','Trade Inbox');
  if(!w.ready){w.ready=true;w.el.classList.add('trade-inbox-window');w.el.querySelector('.window-content').innerHTML=`<div class="trade-topbar"><strong>⇄ Trade Inbox</strong><button class="xp-button" data-trade-refresh>↻ Refresh</button></div><div class="trade-inbox-content"><div class="trade-list" aria-label="Your trade offers"></div><div class="trade-detail" aria-label="Trade details"><p>Select a trade to view its conversation.</p></div></div><div class="window-status"><span>Private offers and conversations</span><span>Refresh to check for new messages</span></div>`;w.el.querySelector('[data-trade-refresh]').onclick=()=>refreshTradeInbox()}
  refreshTradeInbox();
}
async function refreshTradeInbox(selected){
  const w=wins.get('trade-inbox');if(!w)return;
  const list=w.el.querySelector('.trade-list'),detail=w.el.querySelector('.trade-detail');
  list.innerHTML='<p class="trade-muted">Loading offers...</p>';
  try{
    const uid=await tradeUser();
    const {data,error}=await tradeitDb.from('trades').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    const trades=data||[];
    const ids=[...new Set(trades.flatMap(t=>[t.offered_listing_id,t.requested_listing_id]))];
    const lookup={};
    if(ids.length){const {data:rows,error:listingError}=await tradeitDb.from('listings').select('id,title').in('id',ids);if(listingError)throw listingError;(rows||[]).forEach(r=>lookup[r.id]=r.title)}
    w.trades=trades;w.tradeNames=lookup;w.tradeUid=uid;
    list.innerHTML=trades.length?trades.map(t=>`<button class="trade-entry ${t.id===(selected||w.selectedTrade)?'selected':''}" data-trade-id="${esc(t.id)}"><strong>${esc(lookup[t.offered_listing_id]||'Item')} ⇄ ${esc(lookup[t.requested_listing_id]||'Item')}</strong><span>${t.proposer_id===uid?'Sent':'Received'} · ${esc(t.status)}</span><small>${esc(tradeDate(t.created_at))}</small></button>`).join(''):'<p class="trade-muted">No offers yet. Open a real listing and choose “Propose a trade.”</p>';
    list.querySelectorAll('[data-trade-id]').forEach(b=>b.onclick=()=>showTradeDetail(b.dataset.tradeId));
    const id=selected||w.selectedTrade;
    if(id&&trades.some(t=>t.id===id))await showTradeDetail(id);
    else detail.innerHTML='<p class="trade-muted">Select an offer to see messages and actions.</p>';
  }catch(err){list.innerHTML=`<p class="trade-error">${esc(tradeError(err))}</p>`;detail.innerHTML='<p class="trade-muted">Sign in to view your trade offers.</p>'}
}
async function showTradeDetail(id){
  const w=wins.get('trade-inbox');if(!w)return;
  const t=w.trades?.find(x=>x.id===id);if(!t)return;
  w.selectedTrade=id;
  w.el.querySelectorAll('.trade-entry').forEach(b=>b.classList.toggle('selected',b.dataset.tradeId===id));
  const detail=w.el.querySelector('.trade-detail');detail.innerHTML='<p>Loading conversation...</p>';
  const uid=w.tradeUid,recipient=t.recipient_id===uid,proposer=t.proposer_id===uid;
  try{
    const {data:messages,error}=await tradeitDb.from('trade_messages').select('id,sender_id,body,created_at').eq('trade_id',id).order('created_at',{ascending:true});
    if(error)throw error;
    const names=w.tradeNames;
    const controls=t.status==='pending'?(recipient?'<button data-trade-action="accepted" class="xp-button blue">Accept offer</button><button data-trade-action="declined" class="xp-button">Decline</button>':proposer?'<button data-trade-action="cancelled" class="xp-button">Cancel offer</button>':''):t.status==='accepted'?`<button data-trade-confirm class="xp-button blue" ${recipient?t.recipient_confirmed_at?'disabled':'':t.proposer_confirmed_at?'disabled':''}>${recipient?t.recipient_confirmed_at?'You confirmed':'Confirm exchange':t.proposer_confirmed_at?'You confirmed':'Confirm exchange'}</button>`:'';
    const mine=recipient?t.recipient_confirmed_at:t.proposer_confirmed_at;
    detail.innerHTML=`<div class="trade-detail-header"><h2>${esc(names[t.offered_listing_id]||'Offered item')} ⇄ ${esc(names[t.requested_listing_id]||'Requested item')}</h2><p>Status: <strong>${esc(t.status)}</strong> · ${recipient?'Incoming offer':'Outgoing offer'}</p>${t.status==='accepted'?`<p>${mine?'You have confirmed the exchange.':'Confirm only after the physical exchange has happened.'} ${t.proposer_confirmed_at&&t.recipient_confirmed_at?'Both confirmed.':'Both participants must confirm.'}</p>`:''}<div class="trade-actions">${controls}</div></div><div class="trade-messages">${messages?.length?messages.map(m=>`<div class="trade-message ${m.sender_id===uid?'mine':''}"><strong>${m.sender_id===uid?'You':'Other trader'}</strong><p>${esc(m.body)}</p><small>${esc(tradeDate(m.created_at))}</small></div>`).join(''):'<p class="trade-muted">No messages yet.</p>'}</div>${['pending','accepted'].includes(t.status)?'<form class="trade-message-form"><label>Send a message<textarea name="body" required maxlength="2000" placeholder="Write a message to the other trader..."></textarea></label><button class="xp-button blue">Send message</button></form>':'<p class="trade-muted">This trade is closed; messaging is disabled.</p>'}<p class="trade-error" data-trade-error role="status"></p>`;
    detail.querySelectorAll('[data-trade-action]').forEach(b=>b.onclick=async()=>{if(!confirm(`Are you sure you want to ${b.dataset.tradeAction} this offer?`))return;b.disabled=true;try{const {error}=await tradeitDb.rpc('respond_to_trade',{p_trade_id:id,p_action:b.dataset.tradeAction});if(error)throw error;await loadSharedListings();await refreshTradeInbox(id);toast('Trade updated.')}catch(err){detail.querySelector('[data-trade-error]').textContent=tradeError(err);b.disabled=false}});
    const confirmButton=detail.querySelector('[data-trade-confirm]');if(confirmButton)confirmButton.onclick=async()=>{if(!confirm('Confirm that you have physically exchanged the items? This cannot be undone.'))return;confirmButton.disabled=true;try{const {error}=await tradeitDb.rpc('confirm_trade_completion',{p_trade_id:id});if(error)throw error;await loadSharedListings();await refreshTradeInbox(id);toast('Confirmation recorded.')}catch(err){detail.querySelector('[data-trade-error]').textContent=tradeError(err);confirmButton.disabled=false}};
    const form=detail.querySelector('.trade-message-form');if(form)form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),body=form.elements.body.value.trim();if(!body)return;button.disabled=true;try{const {error}=await tradeitDb.from('trade_messages').insert({trade_id:id,sender_id:uid,body});if(error)throw error;await showTradeDetail(id)}catch(err){detail.querySelector('[data-trade-error]').textContent=tradeError(err);button.disabled=false}};
    detail.querySelector('.trade-messages').scrollTop=detail.querySelector('.trade-messages').scrollHeight;
  }catch(err){detail.innerHTML=`<p class="trade-error">${esc(tradeError(err))}</p>`}
}
