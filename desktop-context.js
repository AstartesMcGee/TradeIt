
(function () {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  const menu = document.createElement('div');
  menu.id = 'desktop-context-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  menu.innerHTML = `
    <button type="button" role="menuitem" data-context-refresh>
      ↻ &nbsp; Refresh
    </button>
    <div class="context-separator"></div>
    <button type="button" role="menuitem" data-context-properties>
      ⚙ &nbsp; Properties
    </button>
  `;

  document.body.appendChild(menu);

  function closeMenu() {
    menu.hidden = true;
  }

  desktop.addEventListener('contextmenu', event => {
    // Only allow the menu on empty desktop space.
    if (event.target.closest(
      '.xp-window, .desktop-shortcut, button, input, textarea, select'
    )) {
      closeMenu();
      return;
    }

    event.preventDefault();

    menu.hidden = false;

    const width = menu.offsetWidth;
    const height = menu.offsetHeight;

    menu.style.left =
      Math.max(0, Math.min(event.clientX, innerWidth - width - 4)) + 'px';

    menu.style.top =
      Math.max(0, Math.min(event.clientY, innerHeight - height - 4)) + 'px';
  });

  document.addEventListener('pointerdown', event => {
    if (!menu.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  menu.querySelector('[data-context-refresh]').onclick = () => {
    closeMenu();
    location.reload();
  };

  menu.querySelector('[data-context-properties]').onclick = () => {
    closeMenu();
    toast('Display Properties is coming next!');
  };
})();
