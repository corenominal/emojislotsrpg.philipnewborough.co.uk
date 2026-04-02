function showTrollCharm() {
    const machine = document.querySelector('.machine');
    if (!machine) return;

    // Only show once
    if (machine.querySelector('.troll-charm')) return;

    const infoEl = machine.querySelector('.info');
    const img = document.createElement('img');
    img.src = 'img/troll.png';
    img.alt = 'Lucky troll';
    img.className = 'troll-charm';

    if (infoEl) {
        // Centre the image vertically on the mid-point of the info bar
        img.style.top = (infoEl.offsetTop + infoEl.offsetHeight / 2) + 'px';
    }

    machine.appendChild(img);
}
