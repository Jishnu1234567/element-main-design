/* Element Sound Studio — Homepage Intro Audio */

(function () {
  'use strict';

  var audio = document.getElementById('introAudio');
  var toggle = document.getElementById('audioToggle');

  if (!audio || !toggle) return;

  var muted = false;
  var fallbackArmed = false;

  function updateButton() {
    toggle.classList.toggle('is-muted', muted);
    toggle.classList.toggle('is-playing', !audio.paused && !audio.ended);

    toggle.setAttribute('aria-pressed', String(muted));
    toggle.setAttribute(
      'aria-label',
      muted ? 'Play intro audio' : 'Mute intro audio'
    );
  }

  function removeFallbackListeners() {
    document.removeEventListener('pointerdown', resumeOnInteraction, true);
    document.removeEventListener('touchstart', resumeOnInteraction, true);
    document.removeEventListener('keydown', resumeOnInteraction, true);
  }

  function resumeOnInteraction() {
    if (muted) return;

    audio.play()
      .then(function () {
        updateButton();
        removeFallbackListeners();
      })
      .catch(function () {
        // Browser may still block playback.
      });
  }

  function armFallback() {
    if (fallbackArmed) return;

    fallbackArmed = true;

    /*
     * Capture phase means this works even if another element
     * stops the click event from bubbling.
     */
    document.addEventListener('pointerdown', resumeOnInteraction, true);
    document.addEventListener('touchstart', resumeOnInteraction, true);
    document.addEventListener('keydown', resumeOnInteraction, true);
  }

  function playIntro() {
    if (muted) return;

    var promise = audio.play();

    if (promise && promise.then) {
      promise
        .then(function () {
          updateButton();
          removeFallbackListeners();
        })
        .catch(function () {
          /*
           * Autoplay was blocked.
           * Wait for the visitor's first interaction.
           */
          armFallback();
          updateButton();
        });
    }
  }

  function setMuted(state) {
    muted = state;

    if (muted) {
      audio.pause();
    } else {
      playIntro();
    }

    updateButton();
  }

  /* Button interaction */
  toggle.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (muted || audio.paused || audio.ended) {
      setMuted(false);
    } else {
      setMuted(true);
    }
  });

  /* Keep UI synchronized with the actual audio */
  audio.addEventListener('play', updateButton);
  audio.addEventListener('pause', updateButton);
  audio.addEventListener('ended', updateButton);

  /*
   * IMPORTANT:
   * Try to play immediately when THIS PAGE loads.
   */
  playIntro();

  /*
   * Always prepare the browser-interaction fallback.
   * If autoplay is allowed, these listeners are removed after playback starts.
   */
  armFallback();

  updateButton();

})();