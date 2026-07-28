// Element Sound Studio by RM Productions — interaction layer
(function () {
  'use strict';

  /* ---------------- Loader ---------------- */
  var loader = document.getElementById('loader');
  var header = document.getElementById('siteHeader');
  var scrollPrompt = document.getElementById('scrollPrompt');

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (loader) loader.classList.add('is-hidden');
      if (header) header.classList.add('is-visible');
      if (scrollPrompt) scrollPrompt.classList.add('is-visible');
    }, 900);
  });
  // Fallback in case 'load' fires slowly on the hotlinked hero video
  setTimeout(function () {
    if (loader) loader.classList.add('is-hidden');
    if (header) header.classList.add('is-visible');
    if (scrollPrompt) scrollPrompt.classList.add('is-visible');
  }, 2500);

  /* ---------------- Skip the opening title card on brand videos ----------------
     Every clip opens on a few seconds of "ELEMENT SOUND STUDIOS" title card,
     which is redundant next to on-page headings and gets cropped awkwardly by
     object-fit:cover on portrait screens. Jumping playback past it (and
     re-jumping every time the native loop restarts at 0) keeps every hero /
     banner / feature video showing real footage only, on every device. */
  var INTRO_SKIP = 3;
  var skipVideos = document.querySelectorAll('.hero__video, .hero-banner video, .feature-card__video, .lazy-bg-video');
  skipVideos.forEach(function (video) {
    function pastIntro() {
      if (video.duration > INTRO_SKIP + 0.5 && video.currentTime < INTRO_SKIP) {
        video.currentTime = INTRO_SKIP;
      }
    }
    video.addEventListener('loadedmetadata', pastIntro);
    video.addEventListener('playing', pastIntro);
    video.addEventListener('timeupdate', pastIntro);
  });

  /* ---------------- Lazy-load decorative below-the-fold videos ----------------
     These accompany body copy throughout About/Contact and have no responsive
     mobile source, so the fix is to simply not fetch them at all until their
     section is about to be seen (preload="none" in HTML defers the request;
     this just triggers the actual load+play once nearby). */
  var lazyBgVideos = document.querySelectorAll('.lazy-bg-video');
  if (lazyBgVideos.length) {
    var lazyIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var video = entry.target;
        if (video.paused) video.play().catch(function () {});
        lazyIo.unobserve(video);
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
    lazyBgVideos.forEach(function (video) { lazyIo.observe(video); });
  }

  /* ---------------- Animated "Passion" heading ---------------- */
  var headingEl = document.getElementById('animatedHeading');
  var lettersHost = document.getElementById('animatedLetters');
  if (headingEl && lettersHost) {
    var word = headingEl.dataset.word || 'Passion';
    word.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = 'letter';
      span.textContent = ch;
      span.style.transitionDelay = (i * 40) + 'ms';
      span.addEventListener('click', function () {
        span.classList.remove('jump');
        void span.offsetWidth;
        span.classList.add('jump');
      });
      lettersHost.appendChild(span);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          headingEl.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    io.observe(headingEl);
  }

  /* ---------------- "Find out more" link char stagger ---------------- */
  var link = document.getElementById('findOutMoreLink');
  if (link) {
    var text = link.textContent;
    link.textContent = '';
    text.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--i', i);
      span.textContent = ch === ' ' ? ' ' : ch;
      link.appendChild(span);
    });
  }

  /* ---------------- Testimonial carousel ---------------- */
  var slides = document.querySelectorAll('.testimonial-slide');
  var dotsHost = document.getElementById('testimonialDots');
  if (slides.length && dotsHost) {
    var current = 0;
    var timer = null;

    slides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Go to quote ' + (i + 1));
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', function () { goTo(i); resetTimer(); });
      dotsHost.appendChild(dot);
    });
    var dots = dotsHost.querySelectorAll('button');

    function goTo(index) {
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      current = index;
      slides[current].classList.add('is-active');
      dots[current].classList.add('is-active');
    }

    function next() { goTo((current + 1) % slides.length); }

    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(next, 5000);
    }

    var section = document.querySelector('.testimonial-section');
    if (section) {
      section.addEventListener('mouseenter', function () { clearInterval(timer); });
      section.addEventListener('mouseleave', resetTimer);
    }
    resetTimer();
  }

  /* ---------------- Fullscreen menu overlay ---------------- */
  var menuToggle = document.getElementById('menuToggle');
  var menuOverlay = document.getElementById('menuOverlay');
  if (menuToggle && menuOverlay) {
    var items = menuOverlay.querySelectorAll('.menu-overlay__item');

    function openMenu() {
      menuOverlay.classList.add('is-open');
      menuToggle.classList.add('is-open');
      menuToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      menuOverlay.classList.remove('is-open');
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    menuToggle.addEventListener('click', function () {
      if (menuOverlay.classList.contains('is-open')) closeMenu(); else openMenu();
    });

    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        menuOverlay.style.setProperty('--overlay-color', item.dataset.color);
        item.style.color = item.dataset.hover;
      });
      item.addEventListener('mouseleave', function () {
        item.style.color = '#fff';
      });
    });

    menuOverlay.addEventListener('mouseleave', function () {
      menuOverlay.style.setProperty('--overlay-color', '#1e1a17');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ---------------- Image lightbox (poster & gallery previews) ---------------- */
  var lightboxTriggers = document.querySelectorAll('.poster-card, .photo-gallery__item, .program-feature__poster');
  if (lightboxTriggers.length) {
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<button type="button" class="lightbox__close" aria-label="Close">&times;</button><img class="lightbox__img" alt="">';
    document.body.appendChild(lightbox);

    var lightboxImg = lightbox.querySelector('.lightbox__img');
    var lightboxClose = lightbox.querySelector('.lightbox__close');

    function openLightbox(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    lightboxTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var img = trigger.querySelector('img');
        if (!img) return;
        openLightbox(trigger.getAttribute('href') || img.src, img.alt);
      });
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* ---------------- Features section: reveal cards + active nav on scroll ---------------- */
  var featureCards = document.querySelectorAll('.feature-card');
  if (featureCards.length) {
    var revealIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var card = entry.target;
        card.classList.add('is-visible');
        var video = card.querySelector('.feature-card__video');
        if (video && video.paused) video.play().catch(function () {});
        revealIo.unobserve(card);
      });
    }, { threshold: 0.15 });
    featureCards.forEach(function (card) { revealIo.observe(card); });

    var navBtns = document.querySelectorAll('.features-nav__btn');
    if (navBtns.length) {
      var activeIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navBtns.forEach(function (btn) {
            btn.classList.toggle('is-active', btn.dataset.target === entry.target.id);
          });
        });
      }, { threshold: 0.6 });
      featureCards.forEach(function (card) { activeIo.observe(card); });

      navBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var target = document.getElementById(btn.dataset.target);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  }
})();
