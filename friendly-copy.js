/* Friendly, current copy and branding for the shared Supabase app. */
(() => {
  const LOGO = 'assets/Mexican_Pickleball_Logo.png';

  const updateUi = () => {
    document.querySelectorAll('.brand img, .access-mark').forEach(img => {
      if (img.getAttribute('src') !== LOGO) {
        img.setAttribute('src', LOGO);
        img.setAttribute('alt', 'Mexican pickleball');
      }
    });

    document.querySelectorAll('.note').forEach(note => {
      if (/Prototype: sessions and RSVPs/i.test(note.textContent || '')) note.remove();
    });

    const createView = document.getElementById('createView');
    if (createView) {
      const heading = createView.querySelector(':scope > h2');
      const intro = createView.querySelector(':scope > p.small');
      if (heading) heading.textContent = 'Set up a game';
      if (intro) intro.textContent = 'Pick the play, time and courts — then add it to the calendar.';
    }

    document.querySelectorAll('.empty').forEach(box => {
      if (/Nothing scheduled/i.test((box.textContent || '').trim())) {
        box.textContent = 'No games here yet. Tap + Play and get one going!';
      }
    });
  };

  updateUi();
  const observer = new MutationObserver(() => requestAnimationFrame(updateUi));
  observer.observe(document.body, { childList: true, subtree: true });
})();
