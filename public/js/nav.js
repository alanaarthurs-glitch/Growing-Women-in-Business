/* Topbar menu. No dependencies, loaded on every page before </body>.
   Below 860px the nav is hidden by CSS until .topbar carries .is-open. */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;

    var toggle = topbar.querySelector('.nav-toggle');
    var nav = topbar.querySelector('.site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      if (open) {
        topbar.classList.add('is-open');
      } else {
        topbar.classList.remove('is-open');
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    setOpen(false);

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    document.addEventListener('keydown', function (event) {
      var key = event.key || event.keyCode;
      if (key !== 'Escape' && key !== 'Esc' && key !== 27) return;
      if (!isOpen()) return;
      setOpen(false);
      toggle.focus();
    });

    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        setOpen(false);
      });
    }
  });
})();
