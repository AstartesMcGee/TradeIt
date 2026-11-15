
(function () {
  window.openDisplayProperties = function () {
    const existing = document.getElementById('display-properties');
    if (existing) {
      existing.style.display = 'block';
      return;
    }

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
            <option value="">Current wallpaper</option>
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

    const close = () => overlay.remove();

    overlay.querySelector('[data-close]').onclick = close;
    overlay.querySelector('[data-cancel]').onclick = close;
    overlay.querySelector('[data-ok]').onclick = close;

    overlay.querySelector('[data-apply]').onclick = () => {
      // Wallpaper changes will be connected next.
    };

    overlay.querySelector('[data-browse]').onclick = () => {
      overlay.querySelector('[data-wallpaper-file]').click();
    };

    const desktop = document.getElementById('desktop');
    const preview = overlay.querySelector('.wallpaper-preview-screen');

    if (desktop) {
      preview.style.backgroundImage =
        getComputedStyle(desktop).backgroundImage;

      const wallpaper = getComputedStyle(desktop)
        .getPropertyValue('--desktop-wallpaper').trim();

      if (wallpaper) preview.style.backgroundImage = wallpaper;
    }
  };
})();
