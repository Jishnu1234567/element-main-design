/* Element Sound Studio — homepage intro voice-over.

   IMPORTANT, please read before changing this file:
   Every browser (Chrome, Safari, Firefox, Edge — desktop and mobile)
   refuses to play audio with sound until the visitor has clicked,
   tapped, or pressed a key on the page at least once. This is enforced
   by the browser itself, not by this website, and there is no code
   change on any site that can play sound before that first interaction
   happens. This file does the best any website can do within that
   rule: it tries to play immediately on every load (succeeds only if
   the browser has already decided to trust this site from earlier
   visits), and the moment it doesn't succeed, it quietly waits for the
   visitor's very next interaction — anywhere on the page, not a
   specific button — and plays then, with no visible prompt.
   The speaker icon next to the menu button lets visitors mute it, or
   replay it on demand, at any time. */
(function () {
  'use strict';
  var audio = document.getElementById('introAudio');
  var toggle = document.getElementById('audioToggle');
  if (!audio || !toggle) return;

  var muted = false;

  function setMuted(state) {
    muted = state;
    toggle.classList.toggle('is-muted', muted);
    toggle.setAttribute('aria-pressed', String(muted));
    toggle.setAttribute('aria-label', muted ? 'Play intro audio' : 'Mute intro audio');
    if (muted) audio.pause();
  }

  function armFallback() {
    function resumeOnInteraction() {
      if (!muted) audio.play().catch(function () {});
      document.removeEventListener('click', resumeOnInteraction, true);
      document.removeEventListener('touchstart', resumeOnInteraction, true);
      document.removeEventListener('keydown', resumeOnInteraction, true);
      document.removeEventListener('pointerdown', resumeOnInteraction, true);
    }
    // Capture phase so this fires even if something else on the page
    // stops propagation on the click (e.g. a button's own handler).
    document.addEventListener('click', resumeOnInteraction, true);
    document.addEventListener('touchstart', resumeOnInteraction, true);
    document.addEventListener('keydown', resumeOnInteraction, true);
    document.addEventListener('pointerdown', resumeOnInteraction, true);
  }

  function tryPlay() {
    if (muted) return;
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        armFallback();
      });
    }
  }

  toggle.addEventListener('click', function () {
    if (muted) { setMuted(false); tryPlay(); } else { setMuted(true); }
  });

  // Always attempt on load — every fresh page load gets its own chance,
  // and its own fallback-on-interaction if the immediate attempt is blocked.
  tryPlay();
  // Belt-and-braces: arm the fallback regardless of whether the play()
  // promise had a chance to reject yet (some browsers resolve/reject late).
  armFallback();
})();
