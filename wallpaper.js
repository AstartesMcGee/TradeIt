
(function initializeWallpaper() {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  const DEFAULT_WALLPAPER = 'wallpapers/glass-city.jpg';
  const CACHE_KEY = 'tradeit.wallpaper.last.v1';

  let wallpaper = DEFAULT_WALLPAPER;

  // Immediately display the last successfully saved wallpaper.
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));

    if (
      cached &&
      typeof cached.url === 'string' &&
      (
        cached.url.startsWith('wallpapers/') ||
        (
          cached.url.startsWith(
            'https://'
          ) &&
          cached.url.includes(
            '/storage/v1/object/public/user-wallpapers/'
          )
        )
      )
    ) {
      wallpaper = cached.url;
    }
  } catch (error) {
    console.warn('Wallpaper cache unavailable:', error);
  }

  desktop.style.setProperty(
    '--desktop-wallpaper',
    `url("${wallpaper}")`
  );

  desktop.classList.add('wallpaper-ready');

  // Expose a cache updater for the Supabase wallpaper module.
  window.cacheTradeItWallpaper = function (url, userId) {
    if (!url || !userId) return;

    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          url,
          userId
        })
      );
    } catch (error) {
      console.warn('Could not cache wallpaper:', error);
    }
  };

  window.clearTradeItWallpaperCache = function () {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.warn('Could not clear wallpaper cache:', error);
    }
  };
})();
