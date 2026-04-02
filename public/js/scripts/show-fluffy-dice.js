function showFluffyDice() {
    const machine = document.querySelector('.machine');
    if (!machine) return;

    // Only show once
    if (machine.querySelector('.fluffy-dice')) return;

    const img = document.createElement('img');
    img.src = 'img/dice.png';
    img.alt = 'Fluffy dice';
    img.className = 'fluffy-dice';
    machine.appendChild(img);
}

// document.addEventListener('DOMContentLoaded', showFluffyDice);
