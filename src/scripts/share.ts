/**
 * Wire up "Share" buttons on terrace cards.
 * Uses Web Share API (mobile), falls back to clipboard copy with a toast.
 */

function showToast(msg: string) {
  const toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('share-toast--show'));
  setTimeout(() => {
    toast.classList.remove('share-toast--show');
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

export function initShareButtons() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-share-btn]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest<HTMLElement>('[data-terrace]');
      if (!card) return;
      const name = card.dataset.name || 'Cette terrasse';
      const anchor = card.id ? `#${card.id}` : '';
      const url = `${location.origin}${location.pathname}${anchor}`;
      const text = `${name} — terrasse ensoleillée sur Terrasses au soleil`;

      if (navigator.share) {
        try {
          await navigator.share({ title: name, text, url });
          return;
        } catch {
          // user cancelled or share failed — fall through to copy
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        btn.classList.add('share-btn--copied');
        const orig = btn.textContent;
        btn.textContent = '✓ Lien copié';
        showToast('Lien copié dans le presse-papiers');
        setTimeout(() => {
          btn.classList.remove('share-btn--copied');
          btn.textContent = orig;
        }, 2000);
      } catch {
        showToast('Impossible de copier le lien');
      }
    });
  });
}
