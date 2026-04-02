function showArcadeCat() {
    const machine = document.querySelector('.machine');
    if (!machine) return;

    // Only show once
    if (machine.querySelector('.arcade-cat')) return;

    const img = document.createElement('img');
    img.src = 'img/cat.png';
    img.alt = 'Lucky ginger cat';
    img.className = 'arcade-cat';
    machine.appendChild(img);

    if (window.sfx && window.sfx.cat) window.sfx.cat.play();
}
