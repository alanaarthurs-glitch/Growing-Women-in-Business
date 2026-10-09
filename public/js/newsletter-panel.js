document.addEventListener('DOMContentLoaded', function () {
  // Supports any number of newsletter forms on one page: class="newsletter-panel-form"
  // for any of them, id="newsletter-panel-form" for a page with just one.
  var forms = document.querySelectorAll('.newsletter-panel-form, #newsletter-panel-form');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var button = form.querySelector('button[type="submit"]');
      var email = input ? input.value : '';
      var source = form.getAttribute('data-source') || undefined;
      var isWaitlist = /Waitlist$/.test(form.getAttribute('data-source') || '');
      var originalButtonText = button ? button.textContent : '';

      if (button) {
        button.disabled = true;
        button.textContent = 'Sending…';
      }

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: source })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            var done = document.createElement('p');
            done.className = 'confirm';
            done.setAttribute('role', 'status');
            done.tabIndex = -1;
            done.textContent = /^Webinar/.test(source || '')
              ? "You're on the list. I'll email you the date as soon as it's set."
              : isWaitlist
              ? "You're on the waitlist. I'll message you the moment it reopens."
              : "You're on the list. Watch your inbox.";
            form.replaceWith(done);
            done.focus();
          } else {
            fail(data && data.error);
          }
        })
        .catch(function () { fail(); });

      function fail(code) {
        if (button) {
          button.disabled = false;
          button.textContent = originalButtonText;
        }
        var msg = form.querySelector('.form-error');
        if (!msg) {
          msg = document.createElement('p');
          msg.className = 'form-error';
          msg.setAttribute('role', 'alert');
          form.appendChild(msg);
        }
        msg.textContent = /email/i.test(code || '')
          ? "That email doesn't look right. Mind checking it?"
          : "That didn't go through. Mind trying again in a moment?";
      }
    });
  });
});
