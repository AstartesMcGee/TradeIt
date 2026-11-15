
(function () {
  const DEFAULT_WALLPAPER = 'glass-city.jpg';

  window.openDisplayProperties = async function () {
    document.getElementById('display-properties')?.remove();

    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    const overlay = document.createElement('div');
    overlay.id = 'display-properties';

    overlay.innerHTML = `
      <div class="display-properties-window"
           role="dialog"
           aria-modal="true"
           aria-label="Display Properties">

        <div class="display-properties-titlebar">
          <span>Display Properties</span>
          <button type="button" data-close
                  aria-label="Close">×</button>
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
            <option value="">Loading...</option>
          </select>

          <div class="wallpaper-browse">
            <button type="button" data-browse>Browse...</button>
            <input type="file"
                   accept="image/png,image/jpeg,image/webp"
                   data-wallpaper-file hidden>
          </div>

          <div class="custom-gallery-heading">
            <strong>My Wallpapers</strong>
            <button type="button" data-refresh-gallery>
              Refresh
            </button>
          </div>

          <div class="custom-wallpaper-gallery"
               data-gallery>
            Loading your wallpapers...
          </div>

          <div class="gallery-actions">
            <button type="button" data-delete disabled>
              Delete Selected
            </button>
          </div>

          <div class="wallpaper-status" data-status></div>
        </div>

        <div class="display-properties-actions">
          <button type="button" data-ok>OK</button>
          <button type="button" data-cancel>Cancel</button>
          <button type="button" data-apply>Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const $ = selector => overlay.querySelector(selector);

    const select = $('#wallpaper-select');
    const preview = $('.wallpaper-preview-screen');
    const gallery = $('[data-gallery]');
    const status = $('[data-status]');
    const fileInput = $('[data-wallpaper-file]');
    const deleteButton = $('[data-delete]');
    const applyButton = $('[data-apply]');
    const okButton = $('[data-ok]');

    const currentWallpaper = getComputedStyle(desktop)
      .getPropertyValue('--desktop-wallpaper')
      .trim();

    const currentMatch = currentWallpaper.match(
      /wallpapers\/([^"')]+)/
    );

    const currentIsCustom =
      currentWallpaper.includes('/user-wallpapers/');

    let selectedPreset = currentMatch
      ? decodeURIComponent(currentMatch[1])
      : DEFAULT_WALLPAPER;

    let selectedPath = null;
    let selectedFile = null;
    let previewUrl = null;
    let wallpapers = [];
    let busy = false;

    function setStatus(message) {
      status.textContent = message;
    }

    function setPreview(url) {
      preview.style.backgroundImage = `url("${url}")`;
    }

    function presetUrl(filename) {
      return 'wallpapers/' + encodeURIComponent(filename);
    }

    function clearFile() {
      selectedFile = null;

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    }

    function close() {
      clearFile();
      overlay.remove();
    }

    function setBusy(value) {
      busy = value;
      applyButton.disabled = value;
      okButton.disabled = value;
      deleteButton.disabled =
        value || !selectedPath;
    }

    function selectPreset(filename) {
      clearFile();
      selectedPath = null;
      selectedPreset = filename;
      select.value = filename;

      setPreview(presetUrl(filename));
      renderGallery();
      setStatus('');
    }

    function selectCustom(wallpaper) {
      clearFile();

      selectedPath = wallpaper.path;
      select.value = '__custom__';

      setPreview(wallpaper.url);
      renderGallery();
      setStatus('Selected: ' + wallpaper.name);
    }

    function renderGallery() {
      gallery.replaceChildren();

      if (!wallpapers.length) {
        gallery.textContent =
          'No custom wallpapers yet. Click Browse to add one.';
        deleteButton.disabled = true;
        return;
      }

      for (const wallpaper of wallpapers) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'custom-wallpaper-tile';

        if (wallpaper.path === selectedPath) {
          tile.classList.add('selected');
        }

        const image = document.createElement('img');
        image.src = wallpaper.url;
        image.alt = wallpaper.name;
        image.loading = 'lazy';

        const name = document.createElement('span');
        name.textContent = wallpaper.name.slice(0, 14);

        tile.append(image, name);

        tile.onclick = () => {
          if (!busy) selectCustom(wallpaper);
        };

        gallery.appendChild(tile);
      }

      deleteButton.disabled = busy || !selectedPath;
    }

    async function loadGallery() {
      if (typeof window.listCustomWallpapers !== 'function') {
        gallery.textContent = 'Wallpaper service is loading.';
        return;
      }

      try {
        wallpapers = await window.listCustomWallpapers();

        if (!overlay.isConnected) return;

        renderGallery();
      } catch (error) {
        console.error('Gallery load failed:', error);

        if (overlay.isConnected) {
          gallery.textContent =
            'Could not load wallpapers. Please sign in.';
        }
      }
    }

    async function applySelection() {
      if (selectedFile) {
        if (typeof window.uploadCustomWallpaper !== 'function') {
          throw new Error('Upload service is not ready.');
        }

        const uploaded =
          await window.uploadCustomWallpaper(selectedFile);

        clearFile();

        wallpapers = await window.listCustomWallpapers();
        selectedPath = uploaded.path;
        select.value = '__custom__';

        setPreview(uploaded.url);
        renderGallery();

        return;
      }

      if (selectedPath) {
        await window.saveExistingCustomWallpaper(selectedPath);
        return;
      }

      await window.saveWallpaperPreference(selectedPreset);
    }

    async function saveSelection(closeAfterSave) {
      if (busy) return;

      setBusy(true);
      setStatus('Saving wallpaper...');

      try {
        await applySelection();

        if (closeAfterSave) {
          close();
        } else {
          setStatus('Wallpaper saved successfully.');
        }
      } catch (error) {
        console.error('Wallpaper save failed:', error);
        setStatus(error.message || 'Could not save wallpaper.');
      } finally {
        if (overlay.isConnected) setBusy(false);
      }
    }

    $('[data-close]').onclick = close;
    $('[data-cancel]').onclick = close;

    applyButton.onclick = () => saveSelection(false);
    okButton.onclick = () => saveSelection(true);

    select.onchange = () => {
      if (busy) return;

      if (select.value === '__custom__') {
        const chosen = wallpapers.find(
          item => item.path === selectedPath
        );

        if (chosen) {
          selectCustom(chosen);
        } else if (wallpapers.length) {
          selectCustom(wallpapers[0]);
        } else {
          select.value = selectedPreset;
          setStatus('Upload a custom wallpaper first.');
        }
      } else {
        selectPreset(select.value);
      }
    };

    $('[data-browse]').onclick = () => {
      if (!busy) fileInput.click();
    };

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';

      if (!file || busy) return;

      if (!['image/jpeg', 'image/png', 'image/webp']
          .includes(file.type)) {
        setStatus('Choose a JPG, PNG, or WebP image.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setStatus('Images must be 5 MB or smaller.');
        return;
      }

      clearFile();

      selectedFile = file;
      selectedPath = null;
      previewUrl = URL.createObjectURL(file);

      setPreview(previewUrl);
      renderGallery();
      setStatus('Ready to upload: ' + file.name);
    };

    $('[data-refresh-gallery]').onclick = async () => {
      if (busy) return;

      setStatus('Refreshing gallery...');
      await loadGallery();
      setStatus('');
    };

    deleteButton.onclick = async () => {
      if (!selectedPath || busy) return;

      const wallpaper = wallpapers.find(
        item => item.path === selectedPath
      );

      if (!wallpaper) return;

      const confirmed = confirm(
        `Permanently delete ${wallpaper.name}?`
      );

      if (!confirmed) return;

      setBusy(true);

      try {
        await window.deleteCustomWallpaper(selectedPath);

        wallpapers = wallpapers.filter(
          item => item.path !== selectedPath
        );

        selectedPath = null;
        selectedPreset = DEFAULT_WALLPAPER;
        select.value = DEFAULT_WALLPAPER;

        setPreview(presetUrl(DEFAULT_WALLPAPER));
        renderGallery();

        setStatus('Wallpaper deleted.');
      } catch (error) {
        console.error('Wallpaper delete failed:', error);
        setStatus(error.message || 'Could not delete wallpaper.');
      } finally {
        setBusy(false);
      }
    };

    // Load the preset wallpaper choices.
    try {
      const response = await fetch('wallpapers.json');

      if (!response.ok) throw new Error('Wallpaper list unavailable.');

      const files = await response.json();

      if (!Array.isArray(files)) {
        throw new Error('Invalid wallpaper list.');
      }

      if (!overlay.isConnected) return;

      select.replaceChildren();

      for (const filename of files) {
        if (
          typeof filename !== 'string' ||
          /[/\\]/.test(filename)
        ) continue;

        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename
          .replace(/\.[^.]+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        select.appendChild(option);
      }

      const customOption = document.createElement('option');
      customOption.value = '__custom__';
      customOption.textContent = 'Custom Wallpaper';
      select.insertBefore(customOption, select.firstChild);

      select.value = currentIsCustom
        ? '__custom__'
        : selectedPreset;

      if (!currentIsCustom) {
        setPreview(presetUrl(selectedPreset));
      } else {
        preview.style.backgroundImage = currentWallpaper;
      }

    } catch (error) {
      console.error(error);
      setStatus('Could not load preset wallpapers.');
    }

    await loadGallery();

    if (!overlay.isConnected) return;

    // Match the currently active custom wallpaper to its gallery tile.
    if (currentIsCustom) {
      const active = wallpapers.find(
        wallpaper => currentWallpaper.includes(wallpaper.url)
      );

      if (active) {
        selectedPath = active.path;
        select.value = '__custom__';
        renderGallery();
      }
    }
  };
})();
