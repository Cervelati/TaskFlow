/* ===========================
   TASKFLOW — PRICING TOGGLE
   ===========================
   Para alterar os preços, edite os atributos
   data-monthly e data-annual em cada .pricing__price
   no arquivo pricing.html.
   =========================== */

(function () {
    const toggle = document.getElementById('billing-toggle');
    const thumb = document.getElementById('toggle-thumb');
    const lblMonth = document.getElementById('lbl-monthly');
    const lblAnnual = document.getElementById('lbl-annual');
    const prices = document.querySelectorAll('.pricing__price[data-monthly]');

    let isAnnual = false;

    function updateUI() {
        /* Thumb */
        thumb.classList.toggle('is-annual', isAnnual);

        /* Track color */
        toggle.classList.toggle('is-annual', isAnnual);

        /* Labels */
        lblMonth.classList.toggle('active', !isAnnual);
        lblAnnual.classList.toggle('active', isAnnual);

        /* Preços */
        prices.forEach(function (el) {
            el.textContent = isAnnual
                ? el.dataset.annual
                : el.dataset.monthly;
        });

        /* Acessibilidade */
        toggle.setAttribute('aria-pressed', String(isAnnual));
    }

    toggle.addEventListener('click', function () {
        isAnnual = !isAnnual;
        updateUI();
    });

    /* Estado inicial */
    lblMonth.classList.add('active');
})();