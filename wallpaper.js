// A shuffled cycle: each wallpaper appears once before the set starts again.
(async function rotateWallpaper() {
  const key = 'tradeit.wallpaperCycle.v1';
  try {
    const response = await fetch('wallpapers.json', { cache: 'no-store' });
    if (!response.ok) return;
    const files = await response.json();
    if (!Array.isArray(files) || !files.length || files.some(f => typeof f !== 'string' || /[/\\]/.test(f))) return;
    let state = {};
    try { state = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    const signature = JSON.stringify(files);
    let queue = state.signature === signature && Array.isArray(state.queue)
      ? state.queue.filter(f => files.includes(f)) : [];
    if (!queue.length) {
      queue = [...files];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      if (queue.length > 1 && queue[0] === state.last) [queue[0], queue[1]] = [queue[1], queue[0]];
    }
    // Try the remaining files if a downloaded image cannot be displayed.
    while (queue.length) {
      const next = queue.shift();
      const url = 'wallpapers/' + encodeURIComponent(next);
      const loaded = await new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
      });
      if (!loaded) continue;
      const desktop = document.getElementById('desktop');
      desktop.style.setProperty('--desktop-wallpaper', `url("${url}")`);
      desktop.classList.add('wallpaper-ready');
      try { localStorage.setItem(key, JSON.stringify({ signature, queue, last: next })); } catch {}
      return;
    }
  } catch { /* Keep the blue desktop if images are unavailable. */ }
})();
