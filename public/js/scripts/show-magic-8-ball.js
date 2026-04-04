function showMagic8Ball() {
    // Only show once
    if (document.getElementById('magic-8-ball')) return;

    const img = document.createElement('img');
    img.src = 'img/8ball.png';
    img.alt = 'Magic 8-Ball';
    img.className = 'magic-8-ball';
    img.id = 'magic-8-ball';

    img.addEventListener('click', () => {
        if (typeof window.openEightBallModal === 'function') {
            window.openEightBallModal();
        }
    });

    // Restore buff glow if a spin-buff is already active (e.g. page reload)
    try {
        if (localStorage.getItem('emojimachine.8ball.buff') === '1') {
            img.classList.add('magic-8-ball--buffed');
        }
    } catch (e) {}

    document.body.appendChild(img);
}
