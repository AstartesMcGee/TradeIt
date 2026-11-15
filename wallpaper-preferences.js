
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

  if (data?.wallpaper_type === 'custom' && data.wallpaper_value) {
    const desktop = document.getElementById('desktop');

    if (desktop) {
      desktop.style.setProperty(
        '--desktop-wallpaper',
        `url("${data.wallpaper_value}")`
      );
      desktop.classList.add('wallpaper-ready');
    }
  } else if (
    data?.wallpaper_type === 'preset' &&
    data.wallpaper_value
  ) {
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


window.uploadCustomWallpaper = async function (file) {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be signed in to upload a wallpaper.');
  }

  // Validate the image.
  const allowedTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const extension = allowedTypes[file.type];

  if (!extension) {
    throw new Error('Only JPG, PNG, and WebP images are supported.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Wallpaper must be 5 MB or smaller.');
  }

  // Each upload gets a unique filename to avoid browser caching.
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('user-wallpapers')
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('user-wallpapers')
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Save the custom wallpaper preference.
  const { error: saveError } = await supabase
    .from('user_wallpaper_preferences')
    .upsert({
      user_id: user.id,
      wallpaper_type: 'custom',
      wallpaper_value: publicUrl
    }, { onConflict: 'user_id' });

  if (saveError) {
    // Remove the newly uploaded image if saving fails.
    await supabase.storage
      .from('user-wallpapers')
      .remove([path]);

    throw saveError;
  }

  // Apply the wallpaper immediately.
  const desktop = document.getElementById('desktop');

  if (desktop) {
    desktop.style.setProperty(
      '--desktop-wallpaper',
      `url("${publicUrl}")`
    );
    desktop.classList.add('wallpaper-ready');
  }
};

