
(function () {
  const DEFAULT_WALLPAPER = 'glass-city.jpg';

  window.openDisplayProperties = async function () {
    const existing = document.getElementById('display-properties');
    if (existing) {
      existing.remove();
    }

    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    const overlay = document.createElement('div');
    overlay.id = 'display-properties';

    overlay.innerHTML = `
      <div class="display-properties-window" role="dialog"
           aria-modal="true" aria-label="Display Properties">
        <div class="display-properties-titlebar">
          <span>Display Properties</span>
          <button type="button" data-close aria-label="Close">×</button>
        </div>

        <div class="display-properties-content">
          <div class="display-properties-tabs">
            <span class="selected">Desktop</span>
          </div>

          <div class="wallpaper-preview">
            <div class="wallpaper-preview-screen"></div>
          </div>

          <label for="wallpaper-select">Background:</label>
          <select id="wallpaper-select">
            <option value="">Loading wallpapers...</option>
          </select>

          <div class="wallpaper-browse">
            <button type="button" data-browse>Browse...</button>
            <input type="file" accept="image/png,image/jpeg,image/webp"
                   data-wallpaper-file hidden>
          </div>
        </div>

        <div class="display-properties-actions">
          <button type="button" data-ok>OK</button>
          <button type="button" data-cancel>Cancel</button>
          <button type="button" data-apply>Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const select = overlay.querySelector('#wallpaper-select');
    const preview = overlay.querySelector('.wallpaper-preview-screen');

    // Temporary selection state. Supabase will be added next.
    let selectedWallpaper = DEFAULT_WALLPAPER;

    function wallpaperUrl(filename) {
      return 'wallpapers/' + encodeURIComponent(filename);
    }

    function showPreview(filename) {
      preview.style.backgroundImage =
        `url("${wallpaperUrl(filename)}")`;
    }

    function applyWallpaper() {
      desktop.style.setProperty(
        '--desktop-wallpaper',
        `url("${wallpaperUrl(selectedWallpaper)}")`
      );
      desktop.classList.add('wallpaper-ready');
    }

    function close() {
      overlay.remove();
    }

    overlay.querySelector('[data-close]').onclick = close;
    overlay.querySelector('[data-cancel]').onclick = close;

    overlay.querySelector('[data-apply]').onclick = applyWallpaper;

    overlay.querySelector('[data-ok]').onclick = () => {
      applyWallpaper();
      close();
    };

    select.onchange = () => {
      selectedWallpaper = select.value;
      showPreview(selectedWallpaper);
    };

    // Load the preset wallpapers from wallpapers.json.
    try {
      const response = await fetch('wallpapers.json');
      if (!response.ok) throw new Error('Cannot load wallpapers.json');

      const files = await response.json();
      if (!Array.isArray(files)) throw new Error('Invalid wallpaper list');

      select.innerHTML = '';

      for (const filename of files) {
        if (typeof filename !== 'string' || /[/\\]/.test(filename)) {
          continue;
        }

        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename
          .replace(/\.[^.]+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        select.appendChild(option);
      }

      if (files.includes(DEFAULT_WALLPAPER)) {
        select.value = DEFAULT_WALLPAPER;
      }

      selectedWallpaper = select.value;
      if (selectedWallpaper) showPreview(selectedWallpaper);

    } catch (error) {
      console.error('Wallpaper list failed:', error);
      select.innerHTML = '<option>Unable to load wallpapers</option>';
    }

    // Custom uploads will be connected to Supabase next.
    overlay.querySelector('[data-browse]').onclick = () => {
      alert('Custom wallpaper uploads are coming next!');
    };
  };
})();
