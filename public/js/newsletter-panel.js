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
      var isWaitlist = form.getAttribute('data-source') === 'Push Waitlist';
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
            form.outerHTML = isWaitlist
              ? '<p class="confirm">You\'re on the waitlist. I\'ll message you the moment it reopens.</p>'
              : '<p class="confirm">You\'re on the list. Watch your inbox.</p>';
          } else {
            if (button) {
              button.disabled = false;
              button.textContent = originalButtonText;
            }
          }
        })
        .catch(function () {
          if (button) {
            button.disabled = false;
            button.textContent = originalButtonText;
          }
        });
    });
  });
});
