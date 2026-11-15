
import { supabase } from './supabase-client.js';

const DEFAULT_WALLPAPER = 'glass-city.jpg';

function setWallpaper(filename) {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  const url = 'wallpapers/' + encodeURIComponent(filename);

  desktop.style.setProperty(
    '--desktop-wallpaper',
    `url("${url}")`
  );

  desktop.classList.add('wallpaper-ready');
}

async function loadWallpaperPreference() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    setWallpaper(DEFAULT_WALLPAPER);
    return;
  }

  const { data, error } = await supabase
    .from('user_wallpaper_preferences')
    .select('wallpaper_type, wallpaper_value')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Unable to load wallpaper:', error);
    return;
  }

  if (data?.wallpaper_type === 'preset' && data.wallpaper_value) {
    setWallpaper(data.wallpaper_value);
  } else {
    setWallpaper(DEFAULT_WALLPAPER);
  }
}

window.saveWallpaperPreference = async function (filename) {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be signed in to save wallpaper settings.');
  }

  const { error } = await supabase
    .from('user_wallpaper_preferences')
    .upsert({
      user_id: user.id,
      wallpaper_type: filename === DEFAULT_WALLPAPER
        ? 'default'
        : 'preset',
      wallpaper_value: filename
    }, { onConflict: 'user_id' });

  if (error) throw error;

  setWallpaper(filename);
};

supabase.auth.onAuthStateChange(() => {
  // Avoid making Supabase requests synchronously inside
  // the auth callback.
  setTimeout(() => {
    loadWallpaperPreference().catch(console.error);
  }, 0);
});

loadWallpaperPreference().catch(console.error);
