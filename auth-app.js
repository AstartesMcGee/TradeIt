// Authentication UI. Credentials are passed directly to the Supabase SDK.
(() => {
  let client, session = null, recovery = false, connectionError = '', busy = false;
  const key = 'account-app';
  const accountIcon = '<span class="account-icon" aria-hidden="true"><span>●</span><b>♟</b></span>';
  function updateLabel() {
    const label = session ? 'My Account' : 'Login / Sign Up';
    document.querySelectorAll('[data-account-label]').forEach(el => el.textContent = label);
    document.querySelectorAll('[data-account-open]').forEach(el => el.setAttribute('aria-label', 'Open ' + label));
  }
  function openAccount(mode = recovery ? 'password' : 'login', message = '') {
    const w = createWindow(key, 'Account — tradeit', 'Account');
    w.el.classList.add('account-window');
    render(w, mode, message);
  }
  function render(w, mode, message = '') {
    const content = w.el.querySelector('.window-content');
    const signedIn = session && !recovery;
    content.innerHTML = `<div class="account-shell"><header class="account-banner">${accountIcon}<div><h1>${signedIn ? 'Welcome back.' : mode === 'signup' ? 'Create your account.' : mode === 'reset' ? 'Forgot your password?' : mode === 'password' ? 'Choose a new password.' : 'Welcome to tradeit.'}</h1><p>${signedIn ? 'You’re signed in to tradeit.' : 'Your trading desktop, with an account of your own.'}</p></div></header><div class="account-body">${signedIn ? `<div class="account-profile"><strong>${esc(session.user.user_metadata?.display_name || 'tradeit member')}</strong><p>${esc(session.user.email || '')}</p></div><p class="account-note">Accounts are connected. Listings and saved items still stay in this browser.</p><button class="xp-button" data-signout>Sign out</button>` : `<div class="account-tabs" role="group" aria-label="Account options"><button type="button" class="xp-button" data-mode="login" aria-pressed="${mode === 'login'}">Log in</button><button type="button" class="xp-button" data-mode="signup" aria-pressed="${mode === 'signup'}">Sign up</button></div><form id="accountForm">${mode === 'signup' ? '<label>Display name<input name="displayName" autocomplete="nickname" maxlength="60" required></label>' : ''}${mode !== 'password' ? '<label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>' : ''}${mode !== 'reset' ? `<label>${mode === 'password' ? 'New password' : 'Password'}<input name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" ${mode !== 'login' ? 'minlength="8"' : ''} maxlength="128" required></label>` : ''}${['signup','password'].includes(mode) ? '<label>Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p class="account-note">Use at least 8 characters.</p>' : ''}<button class="xp-button account-submit" type="submit">${({login:'Log in',signup:'Create account',reset:'Send reset link',password:'Save new password'})[mode] || 'Log in'}</button>${mode === 'login' ? '<button class="account-link" type="button" data-mode="reset">Forgot password?</button>' : ''}</form>`}<p class="account-status" role="status" aria-live="polite"></p></div></div>`;
    const status = content.querySelector('.account-status');
    const say = (text, error = false) => {status.textContent = text; status.classList.toggle('error',error);};
    say(message || connectionError || (!client ? 'Connecting to your account service…' : ''), !!connectionError);
    content.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {if(!busy) render(w,b.dataset.mode);});
    function lock(value) {busy=value; w.el.querySelectorAll('.window-content button, .window-content input').forEach(el => el.disabled=value || !client);}
    content.querySelectorAll('button, input').forEach(el => el.disabled=busy || !client);
    const signout = content.querySelector('[data-signout]');
    if(signout) signout.onclick = async () => {
      lock(true); say('Signing out…');
      try {const {error}=await client.auth.signOut();if(error)throw error;session=null;recovery=false;updateLabel();render(w,'login','You’re signed out.');}
      catch(error){say(error.message || 'Could not sign out. Please try again.',true);}
      finally{busy=false;if(w.el.isConnected)lock(false);}
    };
    const form = content.querySelector('form');
    if(!form)return;
    form.onsubmit = async event => {
      event.preventDefault(); if(busy || !client)return;
      const data = Object.fromEntries(new FormData(form));
      if(data.confirm !== undefined && data.password !== data.confirm) {say('The passwords don’t match.',true);return;}
      lock(true);say('Please wait…');
      const redirect = new URL(location.pathname,location.origin).href;
      try {
        let result;
        if(mode === 'login') result=await client.auth.signInWithPassword({email:data.email.trim(),password:data.password});
        else if(mode === 'signup') result=await client.auth.signUp({email:data.email.trim(),password:data.password,options:{data:{display_name:data.displayName.trim()},emailRedirectTo:redirect}});
        else if(mode === 'reset') result=await client.auth.resetPasswordForEmail(data.email.trim(),{redirectTo:redirect});
        else result=await client.auth.updateUser({password:data.password});
        if(result.error)throw result.error;
        if(mode === 'reset') {form.reset();say('If an account exists for that email, a reset link will arrive shortly.');}
        else if(mode === 'signup' && !result.data.session) {form.reset();say('Check your email for a confirmation link. Then return here to log in.');}
        else {
          if(result.data.session) session=result.data.session;
          if(mode === 'password')recovery=false;
          updateLabel();render(w,'login',mode === 'password' ? 'Your password has been updated.' : 'You’re signed in.');
        }
      } catch(error) {say(error.message || 'Unable to connect. Please try again.',true);}
      finally {busy=false;if(w.el.isConnected)lock(false);}
    };
  }
  const shortcut = document.createElement('button');
  shortcut.className='desktop-shortcut';shortcut.dataset.accountOpen='';
  shortcut.innerHTML=accountIcon+'<span class="desktop-label" data-account-label>Login / Sign Up</span>';
  document.getElementById('desktopIcons').prepend(shortcut);
  activateIcon(shortcut,()=>openAccount());
  const menu=document.createElement('button');menu.dataset.accountOpen='';
  menu.innerHTML=accountIcon+'<span><span data-account-label>Login / Sign Up</span><small>Your tradeit account</small></span>';
  menu.onclick=()=>{openAccount();document.getElementById('startMenu').hidden=true;document.getElementById('startButton').setAttribute('aria-expanded','false');};
  document.querySelector('.start-links').prepend(menu);updateLabel();
  import('./supabase-client.js').then(async module => {
    client=module.supabase;
    client.auth.onAuthStateChange((event,current) => {
      session=current;
      if(event==='PASSWORD_RECOVERY') recovery=true;
      if(event==='SIGNED_OUT')recovery=false;
      updateLabel();
      // Keep SDK callbacks synchronous; update the UI outside the callback.
      setTimeout(()=>{const w=wins.get(key);if(event==='PASSWORD_RECOVERY')openAccount('password');else if(w && !busy)render(w,recovery?'password':'login');},0);
    });
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    session=data.session;updateLabel();
    const w=wins.get(key);if(w && !busy)render(w,recovery?'password':'login');
  }).catch(() => {
    connectionError='Couldn’t connect to the account service. Check your internet connection and refresh to try again.';
    client=null;const w=wins.get(key);if(w)render(w,'login');
  });
})();
