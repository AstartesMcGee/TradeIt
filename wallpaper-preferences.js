
import { supabase } from './supabase-client.js';

const DEFAULT_WALLPAPER = 'glass-city.jpg';
const BUCKET = 'user-wallpapers';

let loadVersion = 0;

function applyWallpaperUrl(url) {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  desktop.style.setProperty(
    '--desktop-wallpaper',
    `url("${url}")`
  );
  desktop.classList.add('wallpaper-ready');
}

function applyPreset(filename) {
  applyWallpaperUrl(
    'wallpapers/' + encodeURIComponent(filename)
  );
}

function getCustomPath(url, userId) {
  if (!url || !userId) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index === -1) return null;

    const path = decodeURIComponent(
      parsed.pathname.slice(index + marker.length)
    );

    return path.startsWith(userId + '/') ? path : null;
  } catch {
    return null;
  }
}

async function requireUser() {
  const { data: { user }, error } =
    await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Please sign in to manage wallpapers.');
  }

  return user;
}

async function loadWallpaperPreference() {
  const version = ++loadVersion;

  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (version !== loadVersion) return;

  if (authError || !user) {
    applyPreset(DEFAULT_WALLPAPER);
    return;
  }

  const { data, error } = await supabase
    .from('user_wallpaper_preferences')
    .select('wallpaper_type, wallpaper_value')
    .eq('user_id', user.id)
    .maybeSingle();

  if (version !== loadVersion) return;

  if (error) {
    console.error('Wallpaper load failed:', error);
    return;
  }

  if (
    data?.wallpaper_type === 'custom' &&
    data.wallpaper_value
  ) {
    applyWallpaperUrl(data.wallpaper_value);
  } else if (
    data?.wallpaper_type === 'preset' &&
    data.wallpaper_value
  ) {
    applyPreset(data.wallpaper_value);
  } else {
    applyPreset(DEFAULT_WALLPAPER);
  }
}

window.getWallpaperPreference = async function () {
  const user = await requireUser();

  const { data, error } = await supabase
    .from('user_wallpaper_preferences')
    .select('wallpaper_type, wallpaper_value')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  return data || {
    wallpaper_type: 'default',
    wallpaper_value: DEFAULT_WALLPAPER
  };
};

window.saveWallpaperPreference = async function (filename) {
  const user = await requireUser();

  if (
    typeof filename !== 'string' ||
    !/^[a-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(filename)
  ) {
    throw new Error('Invalid preset wallpaper.');
  }

  const { error } = await supabase
    .from('user_wallpaper_preferences')
    .upsert({
      user_id: user.id,
      wallpaper_type:
        filename === DEFAULT_WALLPAPER ? 'default' : 'preset',
      wallpaper_value: filename
    }, { onConflict: 'user_id' });

  if (error) throw error;

  ++loadVersion;
  applyPreset(filename);
};

window.listCustomWallpapers = async function () {
  const user = await requireUser();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(user.id, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) throw error;

  return (data || [])
    .filter(file =>
      file.name &&
      /\.(jpg|jpeg|png|webp)$/i.test(file.name)
    )
    .map(file => {
      const path = `${user.id}/${file.name}`;

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      return {
        name: file.name,
        path,
        url: urlData.publicUrl,
        createdAt: file.created_at || null
      };
    });
};

window.saveExistingCustomWallpaper = async function (path) {
  const user = await requireUser();

  if (
    typeof path !== 'string' ||
    !path.startsWith(user.id + '/') ||
    !/^[^/]+\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(path)
  ) {
    throw new Error('Invalid wallpaper path.');
  }

  // Verify that this image actually exists in the user's folder.
  const files = await window.listCustomWallpapers();

  const wallpaper = files.find(file => file.path === path);

  if (!wallpaper) {
    throw new Error('This wallpaper no longer exists.');
  }

  const { error } = await supabase
    .from('user_wallpaper_preferences')
    .upsert({
      user_id: user.id,
      wallpaper_type: 'custom',
      wallpaper_value: wallpaper.url
    }, { onConflict: 'user_id' });

  if (error) throw error;

  ++loadVersion;
  applyWallpaperUrl(wallpaper.url);

  return wallpaper;
};

window.uploadCustomWallpaper = async function (file) {
  const user = await requireUser();

  const types = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const extension = types[file?.type];

  if (!extension) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Wallpaper must be 5 MB or smaller.');
  }

  const path =
    `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  const { error: saveError } = await supabase
    .from('user_wallpaper_preferences')
    .upsert({
      user_id: user.id,
      wallpaper_type: 'custom',
      wallpaper_value: publicUrl
    }, { onConflict: 'user_id' });

  if (saveError) {
    // Preserve the image if cleanup fails, but never overwrite
    // the existing wallpaper preference on an unsuccessful save.
    await supabase.storage
      .from(BUCKET)
      .remove([path])
      .catch(console.error);

    throw saveError;
  }

  ++loadVersion;
  applyWallpaperUrl(publicUrl);

  return { name: path.split('/').pop(), path, url: publicUrl };
};

window.deleteCustomWallpaper = async function (path) {
  const user = await requireUser();
  const preference = await window.getWallpaperPreference();

  const activePath = preference.wallpaper_type === 'custom'
    ? getCustomPath(preference.wallpaper_value, user.id)
    : null;

  if (path === activePath) {
    throw new Error(
      'Switch to another wallpaper before deleting this one.'
    );
  }

  const wallpapers = await window.listCustomWallpapers();

  if (!wallpapers.some(file => file.path === path)) {
    throw new Error('Wallpaper not found in your gallery.');
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;
};

supabase.auth.onAuthStateChange(() => {
  ++loadVersion;

  // Reset the desktop while the next account loads.
  applyPreset(DEFAULT_WALLPAPER);

  setTimeout(() => {
    loadWallpaperPreference().catch(console.error);
  }, 0);
});

loadWallpaperPreference().catch(console.error);
