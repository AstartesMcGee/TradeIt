function initializeWallpaper() {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  // Permanent default wallpaper.
  const DEFAULT_WALLPAPER = 'wallpapers/glass-city.jpg';

  desktop.style.setProperty(
    '--desktop-wallpaper',
    `url("${DEFAULT_WALLPAPER}")`
  );

  desktop.classList.add('wallpaper-ready');
})();
