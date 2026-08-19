/* Friendly, current copy for the shared Supabase app. */
(() => {
  const updateCopy = () => {
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
      const text = (box.textContent || '').trim();
      if (/Nothing scheduled\. Tap \+ Play to start something\./i.test(text)) {
        box.textContent = 'No games here yet. Tap + Play and get one going!';
      } else if (/Nothing scheduled/i.test(text)) {
        box.textContent = 'No games here yet. Tap + Play and get one going!';
      }
    });
  };

  updateCopy();
  const observer = new MutationObserver(() => requestAnimationFrame(updateCopy));
  observer.observe(document.body, { childList: true, subtree: true });
})();
