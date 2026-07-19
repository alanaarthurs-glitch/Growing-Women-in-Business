document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('newsletter-panel-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var email = input.value;
    button.disabled = true;
    button.textContent = 'Sending…';

    fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
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
