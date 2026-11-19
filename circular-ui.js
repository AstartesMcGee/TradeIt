/* TradeIt circular trades: optional inbox panel, no changes to direct trades. */
(function () {
  const originalOpen = openTradeInbox;
  openTradeInbox = function () {
    originalOpen();
    const w = wins.get('trade-inbox');
    const bar = w?.el.querySelector('.trade-topbar');
    if (!bar || bar.querySelector('[data-circular-tab]')) return;
    const button = document.createElement('button');
    button.className = 'xp-button';
    button.dataset.circularTab = 'true';
    button.textContent = '↻ Circular Trades';
    button.onclick = () => showCircularInbox();
    bar.insertBefore(button, bar.querySelector('[data-trade-refresh]'));
    const pref = document.createElement('button');
    pref.className = 'xp-button';
    pref.textContent = 'Set trade preferences';
    pref.onclick = () => showCircularPreferences();
    bar.insertBefore(pref, button);
    const direct = bar.querySelector('[data-trade-refresh]');
    direct.textContent = '⇄ Direct trades / Refresh';
  };

  async function query(table, columns, build) {
    let q = tradeitDb.from(table).select(columns);
    if (build) q = build(q);
    const {data, error} = await q;
    if (error) throw error;
    return data || [];
  }
  async function showCircularInbox(selectedId) {
    const w = wins.get('trade-inbox');
    if (!w) return;
    const list = w.el.querySelector('.trade-list');
    const detail = w.el.querySelector('.trade-detail');
    list.innerHTML = '<p class="trade-muted">Loading circular trades...</p>';
    detail.innerHTML = '';
    try {
      const uid = await tradeUser();
      const members = await query('circular_trade_participants', '*', q => q.eq('user_id', uid));
      const ids = members.map(p => p.trade_id);
      const proposals = ids.length ? await query('circular_trades', '*', q => q.in('id', ids).order('created_at', {ascending:false})) : [];
      const listingIds = [...new Set(proposals.flatMap(t => [t.listing_a,t.listing_b,t.listing_c]))];
      const listings = listingIds.length ? await query('listings','id,title,user_id,status',q=>q.in('id',listingIds)) : [];
      const names = Object.fromEntries(listings.map(l=>[l.id,l.title]));
      list.innerHTML = proposals.length ? proposals.map(t=>`<button class="trade-entry" data-cycle="${esc(t.id)}"><strong>↻ ${esc(names[t.listing_a]||'Item')} → ${esc(names[t.listing_b]||'Item')} → ${esc(names[t.listing_c]||'Item')}</strong><span>3-person · ${esc(t.status)}</span><small>${esc(tradeDate(t.created_at))}</small></button>`).join('') : '<p class="trade-muted">No circular proposals yet. Use “Set trade preferences” to choose acceptable items.</p>';
      const show = async id => {
        list.querySelectorAll('[data-cycle]').forEach(b=>b.classList.toggle('selected',b.dataset.cycle===id));
        const t=proposals.find(x=>x.id===id);
        if (!t) return;
        detail.innerHTML='<p class="trade-muted">Loading participants...</p>';
        try {
          const people=await query('circular_trade_participants','*',q=>q.eq('trade_id',id));
          const mine=people.find(p=>p.user_id===uid);
          detail.innerHTML=`<div class="trade-detail-header"><h2>↻ Circular trade</h2><p>Status: ${esc(t.status)}</p></div><p><strong>You give:</strong> ${esc(names[mine?.outgoing_listing]||'Item')}</p><p><strong>You receive:</strong> ${esc(names[mine?.incoming_listing]||'Item')}</p><h3>All participants</h3><div>${people.map(p=>`<p>${p.user_id===uid?'You':'Other participant'}: ${esc(names[p.outgoing_listing]||'Item')} → ${esc(names[p.incoming_listing]||'Item')} · ${p.approved_at?'Approved':'Awaiting approval'}${p.received_at?' · Received':''}</p>`).join('')}</div><div class="trade-actions">${t.status==='pending'?`<button class="xp-button blue" data-cycle-action="approve" ${mine?.approved_at?'disabled':''}>${mine?.approved_at?'Approved':'Approve trade'}</button><button class="xp-button" data-cycle-action="decline">Decline</button>`:''}${t.status==='accepted'&&!mine?.received_at?'<button class="xp-button blue" data-cycle-receive>Confirm item received</button>':''}</div><p class="trade-error" data-cycle-error role="status"></p>`;
          detail.querySelectorAll('[data-cycle-action]').forEach(b=>b.onclick=async()=>{
            if(!confirm(b.dataset.cycleAction==='approve'?'Approve this 3-person exchange?':'Decline this proposal for everyone?'))return;
            b.disabled=true;
            const {error}=await tradeitDb.rpc('respond_to_circular_trade',{p_trade_id:id,p_action:b.dataset.cycleAction});
            if(error){detail.querySelector('[data-cycle-error]').textContent=tradeError(error);b.disabled=false;return;}
            await showCircularInbox(id);
          });
          const receipt=detail.querySelector('[data-cycle-receive]');
          if(receipt)receipt.onclick=async()=>{
            if(!confirm('Confirm you physically received the item? This cannot be undone.'))return;
            receipt.disabled=true;
            const {error}=await tradeitDb.rpc('confirm_circular_trade_receipt',{p_trade_id:id});
            if(error){detail.querySelector('[data-cycle-error]').textContent=tradeError(error);receipt.disabled=false;return;}
            await showCircularInbox(id);
          };
        }catch(e){detail.innerHTML=`<p class="trade-error">${esc(tradeError(e))}</p>`;}
      };
      list.querySelectorAll('[data-cycle]').forEach(b=>b.onclick=()=>show(b.dataset.cycle));
      if(proposals.length)await show(proposals.find(t=>t.id===selectedId)?.id||proposals[0].id);
      else detail.innerHTML='<p class="trade-muted">Circular matches appear here automatically when three users select compatible items.</p>';
    }catch(e){list.innerHTML=`<p class="trade-error">${esc(tradeError(e))}</p>`;}
  }

  async function showCircularPreferences(){
    try{
      const uid=await tradeUser();
      const own=await query('listings','id,title',q=>q.eq('user_id',uid).eq('status','available'));
      const others=await query('listings','id,title,user_id',q=>q.eq('status','available').neq('user_id',uid));
      if(!own.length||!others.length){toast('You need an available listing and another user\'s available listing.');return;}
      const existing=await query('circular_trade_preferences','id,offered_listing_id,desired_listing_id');
      $('#modal').dataset.title='Circular trade preferences — tradeit';
      modal(`<h2>Acceptable items</h2><p>Choose an item you own, and an item you would accept for it. This can automatically generate circular proposals.</p><form id="circularPreferenceForm"><label>Your item<select name="offered">${own.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('')}</select></label><label>Item you want<select name="desired">${others.map(l=>`<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('')}</select></label><button class="primary">Add preference</button><p id="circularPreferenceError" role="status"></p></form><h3>Your preferences</h3><div id="circularExisting">${existing.length?existing.map(p=>`<p>${esc(own.find(l=>l.id===p.offered_listing_id)?.title||'Item')} → ${esc(others.find(l=>l.id===p.desired_listing_id)?.title||'Item')} <button class="xp-button" data-remove-pref="${esc(p.id)}">Remove</button></p>`).join(''):'<p>None yet.</p>'}</div>`);
      $('#circularPreferenceForm').onsubmit=async e=>{
        e.preventDefault();
        const f=e.currentTarget, b=f.querySelector('button');b.disabled=true;
        const {error}=await tradeitDb.from('circular_trade_preferences').insert({offered_listing_id:f.elements.offered.value,desired_listing_id:f.elements.desired.value});
        if(error){$('#circularPreferenceError').textContent=tradeError(error);b.disabled=false;return;}
        toast('Preference added. Circular matches are checked automatically.');showCircularPreferences();
      };
      document.querySelectorAll('[data-remove-pref]').forEach(b=>b.onclick=async()=>{
        b.disabled=true;
        const {error}=await tradeitDb.from('circular_trade_preferences').delete().eq('id',b.dataset.removePref);
        if(error){toast(tradeError(error));b.disabled=false;return;}
        showCircularPreferences();
      });
    }catch(e){toast(tradeError(e));}
  }
})();
