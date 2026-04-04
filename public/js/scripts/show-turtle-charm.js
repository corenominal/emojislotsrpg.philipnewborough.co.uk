function showTurtleCharm() {
    const payTable = document.querySelector('.pay-table');
    if (!payTable) return;

    // Only show once
    if (payTable.querySelector('.turtle-charm')) return;

    const img = document.createElement('img');
    img.src = 'img/turtle.png';
    img.alt = 'Hero turtle sticker';
    img.className = 'turtle-charm';
    img.id = 'turtle-charm';

    img.addEventListener('click', () => {
        if (typeof window.openTurtleModal === 'function') {
            window.openTurtleModal();
        }
    });

    payTable.appendChild(img);
}
