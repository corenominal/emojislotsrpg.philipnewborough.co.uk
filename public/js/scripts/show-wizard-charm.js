function showWizardCharm() {
    // Only show once
    if (document.getElementById('wizard-charm')) return;

    const img = document.createElement('img');
    img.src = 'img/wizard.png';
    img.alt = 'Wizard charm';
    img.className = 'wizard-charm';
    img.id = 'wizard-charm';

    img.addEventListener('click', () => {
        const modal = document.getElementById('wizard-modal');
        if (modal) {
            modal.hidden = false;
            if (window.sfx && window.sfx.wizard) { window.sfx.wizard.stop(); window.sfx.wizard.play(); }
        }
    });

    document.body.appendChild(img);

    // Update pay table to show x10 values
    const payTable = document.querySelector('.pay-table');
    if (payTable) {
        payTable.classList.add('wizard-active');
        payTable.querySelectorAll('.pay-row:not(.pay-row--poop):not(.pay-row--skull):not(.pay-row--head)').forEach(row => {
            row.querySelectorAll('span').forEach((span, i) => {
                if (i > 0 && span.textContent.startsWith('+')) {
                    const val = parseInt(span.textContent.slice(1), 10);
                    if (!Number.isNaN(val)) span.textContent = `+${val * 10}`;
                }
            });
        });
        const footnote = payTable.querySelector('.pay-footnote');
        if (footnote) {
            footnote.innerHTML = 'Match left 2 wheels or all 3 · wins unlock bonus feature<br><span class="wizard-pay-note">🧙 Wizard Active — all wins ×10</span>';
        }
    }

    if (window.sfx && window.sfx.wizard) { window.sfx.wizard.stop(); window.sfx.wizard.play(); }
}
