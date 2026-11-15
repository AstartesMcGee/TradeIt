
(function () {
  const DEFAULT_WALLPAPER = 'glass-city.jpg';

  window.openDisplayProperties = async function () {
    const existing = document.getElementById('display-properties');
    if (existing) existing.remove();

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
            <input type="file"
                   accept="image/png,image/jpeg,image/webp"
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
    const fileInput = overlay.querySelector('[data-wallpaper-file]');

    const currentWallpaper = getComputedStyle(desktop)
      .getPropertyValue('--desktop-wallpaper')
      .trim();

    const currentMatch = currentWallpaper.match(
      /wallpapers\/([^"')]+)/
    );

    const isCustomWallpaper =
      currentWallpaper.includes('/user-wallpapers/');

    const customWallpaperImage = isCustomWallpaper
      ? currentWallpaper
      : null;

    let selectedWallpaper = currentMatch
      ? decodeURIComponent(currentMatch[1])
      : DEFAULT_WALLPAPER;

    let selectedCustomFile = null;
    let selectedCustomPreviewUrl = null;

    function wallpaperUrl(filename) {
      return 'wallpapers/' + encodeURIComponent(filename);
    }

    function showPreview(filename) {
      preview.style.backgroundImage =
        `url("${wallpaperUrl(filename)}")`;
    }

    function clearCustomFile() {
      selectedCustomFile = null;

      if (selectedCustomPreviewUrl) {
        URL.revokeObjectURL(selectedCustomPreviewUrl);
        selectedCustomPreviewUrl = null;
      }
    }

    function close() {
      clearCustomFile();
      overlay.remove();
    }

    async function applyWallpaper() {
      if (selectedCustomFile) {
        if (typeof window.uploadCustomWallpaper !== 'function') {
          throw new Error('Custom wallpaper uploads are not ready.');
        }

        await window.uploadCustomWallpaper(selectedCustomFile);

        // The uploaded image is now the active custom wallpaper.
        clearCustomFile();

        const activeWallpaper = getComputedStyle(desktop)
          .getPropertyValue('--desktop-wallpaper')
          .trim();

        let customOption = select.querySelector(
          'option[value="__custom__"]'
        );

        if (!customOption) {
          customOption = document.createElement('option');
          customOption.value = '__custom__';
          customOption.textContent = 'Custom Wallpaper';
          select.insertBefore(customOption, select.firstChild);
        }

        select.value = '__custom__';
        preview.style.backgroundImage = activeWallpaper;
        return;
      }

      if (select.value === '__custom__') {
        // Keep the already-saved custom wallpaper.
        return;
      }

      if (typeof window.saveWallpaperPreference !== 'function') {
        throw new Error('Wallpaper preferences are still loading.');
      }

      await window.saveWallpaperPreference(selectedWallpaper);
    }

    async function saveSelection(closeAfterSave) {
      const applyButton = overlay.querySelector('[data-apply]');
      const okButton = overlay.querySelector('[data-ok]');

      applyButton.disabled = true;
      okButton.disabled = true;

      try {
        await applyWallpaper();

        if (closeAfterSave) close();
      } catch (error) {
        console.error('Wallpaper save failed:', error);
        alert(error.message || 'Could not save wallpaper.');
      } finally {
        applyButton.disabled = false;
        okButton.disabled = false;
      }
    }

    overlay.querySelector('[data-close]').onclick = close;
    overlay.querySelector('[data-cancel]').onclick = close;

    overlay.querySelector('[data-apply]').onclick = () => {
      saveSelection(false);
    };

    overlay.querySelector('[data-ok]').onclick = () => {
      saveSelection(true);
    };

    select.onchange = () => {
      clearCustomFile();

      if (select.value === '__custom__') {
        if (customWallpaperImage) {
          preview.style.backgroundImage = customWallpaperImage;
        }
        return;
      }

      selectedWallpaper = select.value;
      if (selectedWallpaper) showPreview(selectedWallpaper);
    };

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert('Please choose a JPG, PNG, or WebP image.');
        fileInput.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Wallpaper images must be 5 MB or smaller.');
        fileInput.value = '';
        return;
      }

      clearCustomFile();

      selectedCustomFile = file;
      selectedCustomPreviewUrl = URL.createObjectURL(file);

      preview.style.backgroundImage =
        `url("${selectedCustomPreviewUrl}")`;

      fileInput.value = '';
    };

    overlay.querySelector('[data-browse]').onclick = () => {
      fileInput.click();
    };

    try {
      const response = await fetch('wallpapers.json');

      if (!response.ok) {
        throw new Error('Cannot load wallpapers.json');
      }

      const files = await response.json();

      if (!Array.isArray(files)) {
        throw new Error('Invalid wallpaper list');
      }

      if (!overlay.isConnected) return;

      select.innerHTML = '';

      for (const filename of files) {
        if (
          typeof filename !== 'string' ||
          /[/\\]/.test(filename)
        ) {
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

      if (isCustomWallpaper) {
        const option = document.createElement('option');
        option.value = '__custom__';
        option.textContent = 'Custom Wallpaper';

        select.insertBefore(option, select.firstChild);
        select.value = '__custom__';

        preview.style.backgroundImage = currentWallpaper;
      } else {
        if (files.includes(selectedWallpaper)) {
          select.value = selectedWallpaper;
        } else {
          select.value = DEFAULT_WALLPAPER;
        }

        selectedWallpaper = select.value;

        if (selectedWallpaper) {
          showPreview(selectedWallpaper);
        }
      }
    } catch (error) {
      console.error('Wallpaper list failed:', error);

      if (overlay.isConnected) {
        select.innerHTML =
          '<option value="">Unable to load wallpapers</option>';
      }
    }
  };
})();
