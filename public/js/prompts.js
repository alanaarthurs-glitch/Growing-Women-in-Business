/* The copy buttons on /prompts. Each button copies the prompt named in its
   data-target. If the browser won't copy, the prompt opens and is selected
   so she can copy it by hand. */

(function () {
  'use strict';

  // Copies straight away, inside the tap itself, which works on almost every
  // phone. Only if that fails does it try the clipboard API, and it gives up
  // after two seconds so a browser that never answers can't leave her waiting.
  function copyText(text) {
    if (copyNow(text)) return Promise.resolve();
    if (!(navigator.clipboard && window.isSecureContext)) return Promise.reject(new Error('copy failed'));
    return Promise.race([
      navigator.clipboard.writeText(text),
      new Promise(function (resolve, reject) {
        setTimeout(function () { reject(new Error('copy timed out')); }, 2000);
      })
    ]);
  }

  function copyNow(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function selectForHand(pre) {
    var box = pre.closest('details');
    if (box) box.open = true;
    var range = document.createRange();
    range.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var buttons = document.querySelectorAll('.copy-prompt');
    Array.prototype.forEach.call(buttons, function (btn) {
      var label = btn.textContent;
      var status = btn.parentNode.querySelector('.copy-status');
      var timer = null;

      btn.addEventListener('click', function () {
        var pre = document.getElementById(btn.getAttribute('data-target'));
        if (!pre) return;
        clearTimeout(timer);
        copyText(pre.textContent).then(function () {
          btn.textContent = 'Copied';
          if (status) status.textContent = 'Now paste it into your AI and press send.';
        }, function () {
          selectForHand(pre);
          if (status) status.textContent = 'Your browser blocked copying. The prompt is selected: copy it by hand.';
        }).then(function () {
          timer = setTimeout(function () {
            btn.textContent = label;
            if (status) status.textContent = '';
          }, 6000);
        });
      });
    });
  });
})();
