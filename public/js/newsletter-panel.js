document.addEventListener('DOMContentLoaded', function () {
  // Supports any number of newsletter forms on one page (id="newsletter-panel-form"
  // for the first/only one, class="newsletter-panel-form" for any others).
  var forms = document.querySelectorAll('#newsletter-panel-form, .newsletter-panel-form');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var button = form.querySelector('button[type="submit"]');
      var email = input.value;
      var source = form.getAttribute('data-source') || undefined;
      button.disabled = true;
      button.textContent = 'Sending…';

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: source })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          form.outerHTML = data.ok
            ? '<p class="confirm">You\'re on the list — watch your inbox.</p>'
            : '<p class="confirm">That didn\'t send, mind trying again?</p>';
        })
        .catch(function () {
          button.disabled = false;
          button.textContent = 'Sign up';
        });
    });
  });
});
