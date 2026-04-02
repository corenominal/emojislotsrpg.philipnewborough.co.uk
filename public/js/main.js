/**
* Web Demo by Philip Newborough
* More info: https://philipnewborough.co.uk/demos/
*/
document.addEventListener('DOMContentLoaded', () => {

    // ── Audio ─────────────────────────────────────────────────────────────────
    const sfx = {
        start:    new Howl({ src: './audio/start.mp3' }),
        spinning: new Howl({ src: './audio/spinning.mp3', loop: true }),
        reelStop: new Howl({ src: './audio/reel-stop.mp3' }),
        coinUp:   new Howl({ src: './audio/coin-up.mp3' }),
        coinDown: new Howl({ src: './audio/coin-down.mp3' }),
        gameOver: new Howl({ src: './audio/game-over.mp3' }),
        win:      new Howl({ src: './audio/win.mp3' }),
        epicWin:  new Howl({ src: './audio/win-epic.mp3' }),
        lose:     new Howl({ src: './audio/lose.mp3' }),
        poop:     new Howl({ src: './audio/poop.mp3' }),
        bleep:    new Howl({ src: './audio/bleep.mp3' }),
        spinner:  new Howl({ src: './audio/spinner.mp3' }),
        glitch:   new Howl({ src: './audio/glitch.mp3' }),
        rewind:   new Howl({ src: './audio/rewind.mp3' }),
        cat:      new Howl({ src: './audio/cat.mp3' }),
        troll:    new Howl({ src: './audio/troll.mp3' }),
        wizard:   new Howl({ src: './audio/wizard.mp3' }),
    };
    window.sfx = sfx;

    // Background music (plays after Insert Coin) — track chosen randomly on first play
    const bgmTracks = ['./audio/arcade-tide.mp3', './audio/pixel-tide.mp3'];
    let bgm = null;
    function getBgm() {
        if (!bgm) {
            const src = bgmTracks[Math.floor(Math.random() * bgmTracks.length)];
            bgm = new Howl({ src, loop: true, volume: 0.5 });
        }
        return bgm;
    }

    // Settings (persisted): SFX and BGM volume levels
    const settings = {
        sfxVolume: (() => { const v = parseFloat(localStorage.getItem('volume.sfx')); return isNaN(v) ? 1   : Math.max(0, Math.min(1, v)); })(),
        bgmVolume: (() => { const v = parseFloat(localStorage.getItem('volume.bgm')); return isNaN(v) ? 0.5 : Math.max(0, Math.min(1, v)); })(),
    };

    function applyAudioSettings() {
        try {
            Object.keys(sfx).forEach(key => {
                const howl = sfx[key];
                if (howl) {
                    if (typeof howl.volume === 'function') howl.volume(key === 'spinning' ? settings.sfxVolume * 0.3 : settings.sfxVolume);
                }
            });
            if (bgm) {
                if (typeof bgm.volume === 'function') bgm.volume(settings.bgmVolume);
            }
        } catch (e) {
            console.warn('Audio settings apply failed', e);
        }
    }

    applyAudioSettings();

    // Expose helper setters for internal code
    function setSfxVolume(val) {
        settings.sfxVolume = Math.max(0, Math.min(1, val));
        Object.keys(sfx).forEach(key => {
            const howl = sfx[key];
            if (howl && typeof howl.volume === 'function') {
                howl.volume(key === 'spinning' ? settings.sfxVolume * 0.3 : settings.sfxVolume);
            }
        });
        localStorage.setItem('volume.sfx', settings.sfxVolume);
    }

    function setBgmVolume(val) {
        settings.bgmVolume = Math.max(0, Math.min(1, val));
        if (bgm && typeof bgm.volume === 'function') bgm.volume(settings.bgmVolume);
        localStorage.setItem('volume.bgm', settings.bgmVolume);
    }

    // ── DOM references (cached once) ──────────────────────────────────────────
    const coinsEl   = document.querySelector('.coins');
    const infoSpan  = document.querySelector('.info span');
    const btnSpin   = document.getElementById('btn-spin');
    const btnCollect = document.getElementById('btn-collect');
    const holdBtns    = document.querySelectorAll('.btn-hold');
    const nudgeUpBtns = document.querySelectorAll('.btn-nudge-up');
    const nudgeBtns   = document.querySelectorAll('.btn-nudge-up, .btn-nudge-down');
    const canvas    = document.getElementById('wheels-canvas');
    const ctx       = canvas.getContext('2d');
    const dpr       = window.devicePixelRatio || 1;
    const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Settings UI wiring (settings modal + floating button)
    const settingsToggleBtn = document.getElementById('settings-toggle');
    const settingsModalEl   = document.getElementById('settings-modal');
    const settingsCloseBtn  = document.getElementById('settings-close');
    const sfxVolumeEl       = document.getElementById('settings-sfx-volume');
    const bgmVolumeEl       = document.getElementById('settings-bgm-volume');

    // Populate version from SW cache name
    if ('caches' in window) {
        caches.keys().then(keys => {
            const cacheName = keys.find(k => k.startsWith('emojislotsrpg-'));
            if (cacheName) {
                const versionEl = document.getElementById('app-version');
                if (versionEl) versionEl.textContent = cacheName.replace('emojislotsrpg-', '');
            }
        });
    }

    function updateSliderFill(el) {
        if (!el) return;
        const pct = (parseFloat(el.value) / (parseFloat(el.max) || 1)) * 100;
        el.style.setProperty('--fill', `${pct}%`);
    }

    if (sfxVolumeEl) {
        sfxVolumeEl.value = settings.sfxVolume;
        updateSliderFill(sfxVolumeEl);
        sfxVolumeEl.addEventListener('input', (e) => { setSfxVolume(parseFloat(e.target.value)); updateSliderFill(e.target); });
    }
    if (bgmVolumeEl) {
        bgmVolumeEl.value = settings.bgmVolume;
        updateSliderFill(bgmVolumeEl);
        bgmVolumeEl.addEventListener('input', (e) => { setBgmVolume(parseFloat(e.target.value)); updateSliderFill(e.target); });
    }

    // ── Charm persistence ──────────────────────────────────────────────────────
    // Maps charm function name → localStorage key and → scenario ID.
    // Used to persist, restore, and exclude charm scenarios after a resume.
    const CHARM_STORAGE_KEYS = {
        showArcadeCat:   'emojimachine.charm.cat',
        showFluffyDice:  'emojimachine.charm.dice',
        showTrollCharm:  'emojimachine.charm.troll',
        showWizardCharm: 'emojimachine.charm.wizard',
    };
    const CHARM_SCENARIO_IDS = {
        showArcadeCat:   'arcade_cat',
        showFluffyDice:  'lucky_charm_2',
        showTrollCharm:  'troll_charm',
        showWizardCharm: 'zoltan_machine',
    };

    // Clears all localStorage items except volume settings.
    function clearGameStorage() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k !== 'volume.sfx' && k !== 'volume.bgm') keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (err) { /* ignore */ }
    }

    // Load saved coins from localStorage (persisted score)
    try {
        const savedRaw = localStorage.getItem('emojimachine.coins');
        const saved = parseInt(savedRaw, 10);
        if (savedRaw !== null && !Number.isNaN(saved)) {
            coinsEl.textContent = String(saved);
            // Returning player — swap welcome modal for welcome-back modal
            const welcomeModal = document.getElementById('welcome-modal');
            const welcomeBackModal = document.getElementById('welcome-back-modal');
            if (welcomeModal) welcomeModal.remove();
            if (welcomeBackModal) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString();
                const headerEl = document.getElementById('welcome-back-header');
                if (headerEl) headerEl.textContent = `[ SYSTEM RESTORED: ${timeStr} ]`;
                welcomeBackModal.hidden = false;
            }
            // Restore any charms the player had earned
            Object.entries(CHARM_STORAGE_KEYS).forEach(([fn, key]) => {
                try {
                    if (localStorage.getItem(key) === '1' && typeof window[fn] === 'function') {
                        window[fn]();
                    }
                } catch (e) { /* ignore */ }
            });
        }
    } catch (e) {
        // ignore storage errors (privacy modes)
    }

    function openSettings() { if (settingsModalEl) { settingsModalEl.hidden = false; settingsModalEl.classList.add('settings-modal--in'); } }
    function closeSettings(){ if (settingsModalEl) { settingsModalEl.hidden = true; settingsModalEl.classList.remove('settings-modal--in'); } }

    if (settingsToggleBtn) settingsToggleBtn.addEventListener('click', openSettings);
    if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettings);
    if (settingsModalEl) settingsModalEl.addEventListener('click', (e) => { if (e.target === settingsModalEl) closeSettings(); });

    // About modal wiring
    const aboutToggleBtn = document.getElementById('about-toggle');
    const aboutModalEl   = document.getElementById('about-modal');
    const aboutCloseBtn  = document.getElementById('about-close');
    function openAbout()  { if (aboutModalEl) { aboutModalEl.hidden = false; } }
    function closeAbout() { if (aboutModalEl) { aboutModalEl.hidden = true; } }
    if (aboutToggleBtn) aboutToggleBtn.addEventListener('click', openAbout);
    if (aboutCloseBtn)  aboutCloseBtn.addEventListener('click', closeAbout);
    if (aboutModalEl)   aboutModalEl.addEventListener('click', (e) => { if (e.target === aboutModalEl) closeAbout(); });

    // Secret scenario picker — click the profile picture 6× within 2 s to open
    const aboutAvatarEl         = document.getElementById('about-avatar');
    const scenarioPickerModal   = document.getElementById('scenario-picker-modal');
    const scenarioPickerList    = document.getElementById('scenario-picker-list');
    const scenarioPickerCloseBtn = document.getElementById('scenario-picker-close');

    let _avatarClickCount = 0;
    let _avatarClickTimer = null;

    if (aboutAvatarEl) {
        aboutAvatarEl.addEventListener('click', () => {
            _avatarClickCount++;
            clearTimeout(_avatarClickTimer);
            _avatarClickTimer = setTimeout(() => { _avatarClickCount = 0; }, 2000);
            if (_avatarClickCount >= 6) {
                _avatarClickCount = 0;
                clearTimeout(_avatarClickTimer);
                openScenarioPicker();
            }
        });
    }

    async function openScenarioPicker() {
        if (!scenarioPickerModal || !scenarioPickerList) return;
        const scenarios = await loadScenarios();
        scenarioPickerList.innerHTML = '';
        scenarios.forEach(s => {
            const btn = document.createElement('button');
            btn.className   = 'scenario-picker-modal__item';
            btn.textContent = s.title;
            btn.onclick = () => {
                closeScenarioPicker();
                closeAbout();
                if (!rpgActive) {
                    rpgPending = false;
                    triggerEvent(s);
                }
            };
            scenarioPickerList.appendChild(btn);
        });
        scenarioPickerModal.hidden = false;
    }

    function closeScenarioPicker() {
        if (scenarioPickerModal) scenarioPickerModal.hidden = true;
    }

    if (scenarioPickerCloseBtn) scenarioPickerCloseBtn.addEventListener('click', closeScenarioPicker);
    if (scenarioPickerModal)    scenarioPickerModal.addEventListener('click', (e) => { if (e.target === scenarioPickerModal) closeScenarioPicker(); });

    // Wizard charm info modal wiring
    const wizardModalEl  = document.getElementById('wizard-modal');
    const wizardCloseBtn = document.getElementById('wizard-modal-close');
    function closeWizardModal() { if (wizardModalEl) wizardModalEl.hidden = true; }
    if (wizardCloseBtn) wizardCloseBtn.addEventListener('click', closeWizardModal);
    if (wizardModalEl)  wizardModalEl.addEventListener('click', (e) => { if (e.target === wizardModalEl) closeWizardModal(); });

    // Settings: Reset Game — use inline confirm UI (no native confirm)
    const settingsResetBtn = document.getElementById('settings-reset');
    const settingsResetConfirm = document.getElementById('settings-reset-confirm');
    const settingsResetYes = document.getElementById('settings-reset-confirm-yes');
    const settingsResetNo = document.getElementById('settings-reset-confirm-no');
    if (settingsResetBtn && settingsResetConfirm && settingsResetYes && settingsResetNo) {
        settingsResetBtn.addEventListener('click', (e) => {
            settingsResetBtn.hidden = true;
            settingsResetConfirm.hidden = false;
        });
        settingsResetNo.addEventListener('click', (e) => {
            settingsResetConfirm.hidden = true;
            settingsResetBtn.hidden = false;
        });
        settingsResetYes.addEventListener('click', (e) => {
            clearGameStorage();
            window.location.reload();
        });
    }

    // ── Reel data ─────────────────────────────────────────────────────────────
    const roll = [
        ['🌶️','🍒','💩','🦄','🍒','💯','🍇','🥝','💀','🍄','🍒','💩','🍉','🌶️','🍋','🍒','🍆','🍒','🌶️','🍒'],
        ['🌶️','🍋','💩','🥝','🍉','🍆','🍇','🍄','🍒','💩','🌶️','🍒','💯','🍒','🍒','🦄','💀','🍒','🌶️','🍒'],
        ['🍉','💯','💩','🍄','🦄','🌶️','🍋','🍒','🥝','💩','🍆','💀','🍇','🍒'],
    ];

    // Test rolls — uncomment one to force a win/loss condition:
    // Epic win:       [['🦄'×11], ['🦄'×11], ['🦄'×11]]
    // Win:            [['🦄'×11], ['🦄'×11], ['💩'×11]]
    // Epic poop:      [['💩'×11], ['💩'×11], ['💩'×11]]
    // Poop:           [['💩'×11], ['💩'×11], ['🦄'×11]]
    // Instant death:  [['💀'×11], ['💀'×11], ['💀'×11]]
    // Skull near miss:[['💀'×11], ['💀'×11], ['🦄'×11]]

    // ── Prize table ───────────────────────────────────────────────────────────
    // two: award for matching first 2 wheels; three: award for matching all 3.
    // Cherries are the lowest, unicorn the highest; 💯 always pays exactly 100.
    // ── Spin the Wheel segments ─────────────────────────────────────────────
    const SW_SEGMENTS = [
        { label: '×2',   emoji: '💰', type: 'mult', value: 2   },
        { label: 'LOSE', emoji: '💀', type: 'lose', value: 0   },
        { label: '×3',   emoji: '💎', type: 'mult', value: 3   },
        { label: '×2',   emoji: '💰', type: 'mult', value: 2   },
        { label: 'BANK', emoji: '🤑', type: 'bank', value: 1   },
        { label: 'LOSE', emoji: '💀', type: 'lose', value: 0   },
        { label: '×1.5', emoji: '⭐', type: 'mult', value: 1.5 },
        { label: '×2',   emoji: '💰', type: 'mult', value: 2   },
    ];
    const SW_COLORS = [
        '#aa00cc',  // ×2    – neon magenta
        '#06020f',  // LOSE  – near-black deep space
        '#0055aa',  // ×3    – electric blue
        '#880099',  // ×2    – deep neon purple
        '#006688',  // BANK  – teal cyan
        '#0a0020',  // LOSE  – deep space
        '#0099bb',  // ×1.5  – bright cyan
        '#6600bb',  // ×2    – synthwave purple
    ];

    const PRIZES = {
        '🍒': { two: 10, three:  20 },
        '🍄': { two: 10, three:  20 },
        '🥝': { two: 10, three:  30 },
        '🍉': { two: 10, three:  30 },
        '🍋': { two: 10, three:  40 },
        '🍆': { two: 20, three:  40 },
        '🌶️': { two: 20, three:  50 },
        '🍇': { two: 20, three:  60 },
        '💯': { two: 30, three: 100 },
        '🦄': { two: 50, three: 150 },
    };

    // ── Canvas rendering state ────────────────────────────────────────────────
    const ACTIVE_ROW      = 3;
    const SPIN_BASE_TIMES = [2000, 3000, 4000]; // min stop delay (ms) per wheel
    const spinSpeeds      = [125, 100, 75];     // rotation interval (ms) per wheel

    const EMOJI_FONT_FAMILY = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';
    let ROW_HEIGHT = 70, EMOJI_SIZE = 52, WHEEL_GAP = 10;
    let fontStr = `${EMOJI_SIZE}px ${EMOJI_FONT_FAMILY}`;
    let cachedGradients = null;

    // ── Wheel state ───────────────────────────────────────────────────────────
    const wheelSpinning = [false, false, false];
    const wheelOffsets  = [0, 0, 0];

    // ── Hold state ────────────────────────────────────────────────────────────
    const wheelsHeld     = [false, false, false];
    const wheelsHoldable = [false, false, false];
    const BASE_HOLD_PROB = { twoMatch: 0.80, noMatch: 0.20 };
    let currentHoldProb   = null;
    let lastOfferTwoMatch = null;

    // ── Nudge state ───────────────────────────────────────────────────────────
    const NUDGE_PROB    = 0.90;
    let nudgesRemaining = 0;
    let nudgesActive    = false;

    let resetInfo = null;

    // ── Gamble state ─────────────────────────────────────────────────────────────
    const GAMBLE_BASE_SPEED = 330; // ms per label flip
    const GAMBLE_MIN_SPEED  = 80;  // fastest allowed
    let gambleActive        = false;
    let gambleCoins         = 0;       // win stake being wagered
    let gamblePendingPair   = false;   // anyPair result from the spin, for hold offers
    let gamblePendingAllSame = false;  // true when a 3-match triggered the gamble — no hold offer
    let gambleLabel         = 'double'; // currently shown option
    let gambleSpeed         = GAMBLE_BASE_SPEED;
    let gambleTimerId       = null;

    // ── Higher or Lower state ─────────────────────────────────────────────────
    let hlActive    = false;
    let hlCoins     = 0;
    let hlCurrent   = 0;
    let hlResolving = false;

    // ── Pick a Box state ──────────────────────────────────────────────────────
    let pbActive    = false;
    let pbCoins     = 0;
    let pbBoxes     = [];   // ['big', 'bank', 'lose'] shuffled
    let pbChosen    = -1;
    let pbResolving = false;

    // ── Spin the Wheel state ──────────────────────────────────────────────────
    let swActive   = false;
    let swCoins    = 0;
    let swAngle    = 0;
    let swSpinning = false;
    let swAnimId   = null;

    // ── RPG Event System ──────────────────────────────────────────────────────
    // Percentage chance (0–100) that a Random Encounter fires on every 3rd spin.
    // Set to 100 to guarantee an event every 3rd spin, 0 to disable entirely.
    const RPG_ENCOUNTER_CHANCE = 100;

    let rpgScenarios    = null;   // loaded lazily on first check
    let usedScenarios   = [];
    let spinCounter     = 0;
    let rpgPending      = false;  // true when a trigger is queued, waiting for animations to settle
    let rpgActive       = false;  // true while the modal is open

    // RPG DOM refs (resolved once)
    const rpgModal        = document.getElementById('rpg-modal');
    const rpgTitleEl      = document.getElementById('rpg-title');
    const rpgFlavorEl     = document.getElementById('rpg-flavor');
    const rpgDiceArea     = document.getElementById('rpg-dice-area');
    const rpgDiceEl       = document.getElementById('rpg-dice');
    const rpgDiceLabelEl  = document.getElementById('rpg-dice-label');
    const rpgOptionsEl    = document.getElementById('rpg-options');
    const rpgResultEl     = document.getElementById('rpg-result');
    const rpgResultTextEl = document.getElementById('rpg-result-text');
    const rpgContinueBtn  = document.getElementById('rpg-continue');

    // Lucky Dice DOM refs + constant
    const luckyDiceModal        = document.getElementById('lucky-dice-modal');
    const luckyDiceFlavorEl     = document.getElementById('lucky-dice-flavor');
    const luckyDiceDieEl        = document.getElementById('lucky-dice-die');
    const luckyDiceLabelEl      = document.getElementById('lucky-dice-label');
    const luckyDiceResultEl     = document.getElementById('lucky-dice-result');
    const luckyDiceResultTextEl = document.getElementById('lucky-dice-result-text');
    const luckyDiceBtn          = document.getElementById('lucky-dice-btn');
    const LUCKY_DICE_COOLDOWN   = 3 * 60 * 1000; // 3 minutes in ms

    // Troll's Gambit DOM refs + constant
    const trollModal         = document.getElementById('troll-modal');
    const trollFlavorEl      = document.getElementById('troll-flavor');
    const trollEmojiEl       = document.getElementById('troll-emoji');
    const trollResultEl      = document.getElementById('troll-result');
    const trollResultTextEl  = document.getElementById('troll-result-text');
    const trollActionsEl     = document.getElementById('troll-actions');
    const trollPokeBtn       = document.getElementById('troll-poke-btn');
    const trollLeaveBtn      = document.getElementById('troll-leave-btn');
    const trollContinueBtn   = document.getElementById('troll-continue-btn');
    const TROLL_COOLDOWN     = 5 * 60 * 1000; // 5 minutes in ms

    // Cat's Walk DOM refs + constants
    const catModal          = document.getElementById('cat-modal');
    const catFlavorEl       = document.getElementById('cat-flavor');
    const catImgEl          = document.getElementById('cat-img');
    const catWalkingLabelEl = document.getElementById('cat-walking-label');
    const catResultEl       = document.getElementById('cat-result');
    const catResultTextEl   = document.getElementById('cat-result-text');
    const catActionsEl      = document.getElementById('cat-actions');
    const catSendBtn        = document.getElementById('cat-send-btn');
    const catLeaveBtn       = document.getElementById('cat-leave-btn');
    const catContinueBtn    = document.getElementById('cat-continue-btn');
    const CAT_COOLDOWN      = 10 * 60 * 1000; // 10 minutes in ms
    const CAT_COIN_PRIZES   = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000, 10000];

    async function loadScenarios() {
        if (rpgScenarios) return rpgScenarios;
        try {
            const res = await fetch('./scenarios-rpg.json');
            rpgScenarios = await res.json();
        } catch (e) {
            rpgScenarios = [];
        }
        return rpgScenarios;
    }

    function pickScenario(scenarios) {
        // Exclude scenarios whose charm is already active on the machine
        const activeCharmIds = new Set(
            Object.entries(CHARM_STORAGE_KEYS)
                .filter(([, key]) => { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } })
                .map(([fn]) => CHARM_SCENARIO_IDS[fn])
        );
        const available = scenarios.filter(s => !usedScenarios.includes(s.id) && !activeCharmIds.has(s.id));
        // All used — reset (except keep last few out to avoid immediate repeats)
        if (available.length === 0) {
            usedScenarios = usedScenarios.slice(-2);
            return pickScenario(scenarios);
        }
        const s = available[Math.floor(Math.random() * available.length)];
        usedScenarios.push(s.id);
        return s;
    }

    const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

    function animateDice(finalFace, durationMs, label, onDone) {
        rpgDiceArea.hidden  = false;
        rpgDiceLabelEl.textContent = label;
        rpgDiceEl.classList.add('rolling');
        const start = performance.now();
        const tick  = () => {
            const elapsed  = performance.now() - start;
            const progress = Math.min(elapsed / durationMs, 1);
            const interval = Math.round(80 + 220 * Math.pow(progress, 2)); // slow down
            rpgDiceEl.textContent = elapsed < durationMs
                ? DICE_FACES[Math.floor(Math.random() * 6)]
                : finalFace;
            if (elapsed < durationMs) {
                setTimeout(tick, interval);
            } else {
                rpgDiceEl.classList.remove('rolling');
                onDone();
            }
        };
        tick();
    }

    function closeRpgModal(afterClose) {
        rpgActive = false;
        rpgModal.hidden = true;
        // Reset modal state
        rpgDiceArea.hidden  = true;
        rpgResultEl.hidden  = true;
        rpgResultEl.className = 'rpg-modal__result';
        rpgContinueBtn.hidden = true;
        rpgContinueBtn.className = 'rpg-modal__continue';
        rpgOptionsEl.innerHTML = '';
        if (afterClose) afterClose();
    }

    function resolveRpgOutcome(option, scenario, afterAll) {
        // Fixed outcome
        if (option.outcome === 'fixed') {
            const text = option.textSuccess || option.text;
            const isLoss = (option.creditChange || 0) < 0 || option.setCreditsToZero || option.gameOver;
            showRpgResult(text, !isLoss, option, afterAll);
            return;
        }
        // Random outcome — animate dice
        const needed   = Math.ceil(option.chance * 6); // e.g. 0.4 → need 3+ on a d6 (faces 3,4,5,6)
        const roll     = Math.ceil(Math.random() * 6);
        const won      = roll >= needed;
        const faceName     = DICE_FACES[roll - 1];
        const duringLabel  = `Roll ${needed}+ to succeed`;
        const resolvedLabel = `Roll ${needed}+ to succeed (rolled ${roll})`;

        // Disable options while rolling
        rpgOptionsEl.querySelectorAll('.rpg-option-btn').forEach(b => { b.disabled = true; });

        animateDice(faceName, 1800, duringLabel, () => {
            rpgDiceLabelEl.textContent = resolvedLabel;
            const result = won ? option.success : option.failure;
            showRpgResult(result.text, won, result, afterAll);
        });
    }

    function showRpgResult(text, success, data, afterAll) {
        // Hide options
        rpgOptionsEl.querySelectorAll('.rpg-option-btn').forEach(b => b.remove());
        rpgResultEl.hidden = false;
        rpgResultEl.className = `rpg-modal__result ${success ? 'success' : 'failure'}`;
        rpgResultTextEl.textContent = text;

        const isGameOver = data.gameOver === true;
        rpgContinueBtn.hidden = false;
        rpgContinueBtn.textContent = isGameOver ? 'Walk Away…' : 'Continue';
        rpgContinueBtn.className   = isGameOver
            ? 'rpg-modal__continue walkaway'
            : 'rpg-modal__continue';

        rpgContinueBtn.onclick = () => {
            closeRpgModal(() => {
                // Apply credit changes before enabling spin
                const curCoins = +coinsEl.textContent;
                if (data.setCreditsToZero) {
                    coinsEl.textContent = '0';
                    try { localStorage.setItem('emojimachine.coins', '0'); } catch (e) { /* ignore */ }
                }
                if (data.gameOver) {
                    setGameOver();
                    return;
                }
                if (data.function && typeof window[data.function] === 'function') {
                    window[data.function]();
                    if (CHARM_STORAGE_KEYS[data.function]) {
                        try { localStorage.setItem(CHARM_STORAGE_KEYS[data.function], '1'); } catch (e) { /* ignore */ }
                    }
                }
                const change = data.creditChange || (data.creditMultiplier ? Math.round(curCoins * (data.creditMultiplier - 1)) : 0);
                if (change !== 0 && !data.setCreditsToZero) {
                    const newC = Math.max(0, curCoins + change);
                    countCoins(curCoins, newC, false, change > 0 ? `+${change} 🎲` : `${change} 🎲`);
                    // Re-enable spin after counter finishes (count duration ≈ 2s max)
                    setTimeout(() => {
                        if (+coinsEl.textContent >= 10) {
                            btnSpin.textContent = 'Play';
                            btnSpin.classList.add('ready');
                            setReadyInfo();
                        } else {
                            setGameOver();
                        }
                    }, 2200);
                } else {
                    if (data.setCreditsToZero) { setGameOver(); return; }
                    if (+coinsEl.textContent >= 10) {
                        btnSpin.textContent = 'Play';
                        btnSpin.classList.add('ready');
                        setReadyInfo();
                    } else {
                        setGameOver();
                    }
                }
            });
        };

        if (afterAll) afterAll();
    }

    async function triggerEvent(forcedScenario) {
        rpgActive = true;
        rpgPending = false;

        // Make sure spin btn stays locked
        btnSpin.classList.remove('ready');

        const scenarios = await loadScenarios();
        if (!scenarios.length) { rpgActive = false; btnSpin.classList.add('ready'); setReadyInfo(); return; }

        const scenario = forcedScenario || pickScenario(scenarios);

        rpgTitleEl.textContent  = scenario.title;
        rpgFlavorEl.textContent = scenario.flavorText;
        rpgDiceArea.hidden      = true;
        rpgResultEl.hidden      = true;
        rpgContinueBtn.hidden   = true;
        rpgOptionsEl.innerHTML  = '';

        // Build option buttons
        scenario.options.forEach((option, idx) => {
            const btn = document.createElement('button');
            btn.className   = 'rpg-option-btn';
            btn.textContent = option.text;
            btn.disabled    = true;
            btn.onclick = () => {
                // Disable all options immediately
                rpgOptionsEl.querySelectorAll('.rpg-option-btn').forEach(b => { b.disabled = true; });
                resolveRpgOutcome(option, scenario, null);
            };
            rpgOptionsEl.appendChild(btn);
        });

        rpgModal.hidden = false;
        sfx.glitch.play();

        // Re-enable option buttons 1 second after the modal is revealed
        setTimeout(() => {
            rpgOptionsEl.querySelectorAll('.rpg-option-btn').forEach(b => { b.disabled = false; });
        }, 1000);
    }

    // Debug helper — call from the browser console to immediately trigger a scenario by ID.
    // e.g. __debugScenario('big_gaz_tax')  or  __debugScenario() for a random one.
    window.__debugScenario = async (id) => {
        if (rpgActive) { console.warn('[debug] RPG modal already open'); return; }
        const scenarios = await loadScenarios();
        let scenario;
        if (id) {
            scenario = scenarios.find(s => s.id === id);
            if (!scenario) {
                console.warn(`[debug] No scenario found with id "${id}". Available ids:`, scenarios.map(s => s.id));
                return;
            }
        }
        rpgPending = false;
        triggerEvent(scenario);
    };

    // Called at the end of a fully-settled spin (no pending nudges / win features)
    function checkRpgTrigger() {
        // Don't interrupt an active bonus feature or another RPG event
        if (rpgActive || gambleActive || hlActive || pbActive || swActive) return;
        if (!rpgPending) {
            if (+coinsEl.textContent >= 10) {
                btnSpin.textContent = 'Play';
                btnSpin.classList.add('ready');
            }
            return;
        }
        btnSpin.classList.remove('ready');
        triggerEvent();
    }

    // ── Lucky Dice ────────────────────────────────────────────────────────────

    function openLuckyDiceModal() {
        if (!luckyDiceModal) return;
        // Reset visual state
        luckyDiceDieEl.textContent = '🎲';
        luckyDiceDieEl.classList.remove('rolling');
        luckyDiceResultEl.hidden = true;
        luckyDiceResultEl.className = 'lucky-dice-modal__result';
        luckyDiceResultTextEl.textContent = '';
        luckyDiceLabelEl.textContent = '';
        luckyDiceBtn.disabled = false;

        let lastUsed = 0;
        try { lastUsed = parseInt(localStorage.getItem('emojimachine.luckyDice'), 10) || 0; } catch (e) {}
        const isRecharging = (Date.now() - lastUsed) < LUCKY_DICE_COOLDOWN;

        if (isRecharging) {
            luckyDiceFlavorEl.textContent = 'The lucky dice magic is still recharging… Give them a rub and come back soon!';
            luckyDiceLabelEl.textContent  = '';
            luckyDiceBtn.textContent = 'Close';
            luckyDiceBtn.onclick = closeLuckyDiceModal;
        } else {
            luckyDiceFlavorEl.textContent = 'The fluffy dice twist in the stale arcade air. Roll 4 or higher and your coins will be doubled!';
            luckyDiceBtn.textContent = 'Roll the Dice!';
            luckyDiceBtn.onclick = rollLuckyDice;
        }

        luckyDiceModal.hidden = false;
        sfx.glitch.play();
    }

    function closeLuckyDiceModal() {
        if (luckyDiceModal) luckyDiceModal.hidden = true;
    }

    function rollLuckyDice() {
        luckyDiceBtn.disabled = true;
        // Record cooldown start
        try { localStorage.setItem('emojimachine.luckyDice', String(Date.now())); } catch (e) {}

        const NEEDED    = 4;  // roll 4+ to win — exactly 50% (faces 4, 5, 6)
        const dieRoll   = Math.ceil(Math.random() * 6);
        const won       = dieRoll >= NEEDED;
        const finalFace = DICE_FACES[dieRoll - 1];
        const duringLabel   = 'Roll 4+ to double your coins';
        const resolvedLabel = `Roll 4+ to double your coins (rolled ${dieRoll})`;

        luckyDiceDieEl.classList.add('rolling');
        luckyDiceLabelEl.textContent = duringLabel;

        const start    = performance.now();
        const duration = 1800;
        const tick = () => {
            const elapsed  = performance.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const interval = Math.round(80 + 220 * Math.pow(progress, 2));
            luckyDiceDieEl.textContent = elapsed < duration
                ? DICE_FACES[Math.floor(Math.random() * 6)]
                : finalFace;
            if (elapsed < duration) {
                setTimeout(tick, interval);
            } else {
                luckyDiceDieEl.classList.remove('rolling');
                luckyDiceLabelEl.textContent = resolvedLabel;
                finishLuckyDiceRoll(won);
            }
        };
        tick();
    }

    function finishLuckyDiceRoll(won) {
        luckyDiceResultEl.hidden = false;
        if (won) {
            const coins   = +coinsEl.textContent;
            const doubled = coins * 2;
            luckyDiceResultEl.className = 'lucky-dice-modal__result success';
            luckyDiceResultTextEl.textContent = `The dice are on your side! Your ${coins} coins have been DOUBLED to ${doubled}!`;
            sfx.epicWin.stop();
            sfx.epicWin.play();
            luckyDiceBtn.textContent = 'Collect!';
            luckyDiceBtn.disabled    = false;
            luckyDiceBtn.onclick = () => {
                closeLuckyDiceModal();
                countCoins(coins, doubled, false, '🎲 DOUBLED! 🎲');
            };
        } else {
            luckyDiceResultEl.className = 'lucky-dice-modal__result failure';
            luckyDiceResultTextEl.textContent = 'The dice are cold today… No luck this time. Come back soon and try again!';
            sfx.lose.play();
            luckyDiceBtn.textContent = 'Continue';
            luckyDiceBtn.disabled    = false;
            luckyDiceBtn.onclick     = closeLuckyDiceModal;
        }
    }

    // ── Troll's Gambit ────────────────────────────────────────────────────────

    function openTrollModal() {
        if (!trollModal) return;
        // Reset state
        trollEmojiEl.classList.remove('reacting');
        trollResultEl.hidden = true;
        trollResultEl.className = 'troll-modal__result';
        trollResultTextEl.textContent = '';
        trollActionsEl.hidden = false;
        trollPokeBtn.disabled = false;
        trollLeaveBtn.disabled = false;
        trollContinueBtn.hidden = true;
        trollContinueBtn.textContent = '';

        let lastUsed = 0;
        try { lastUsed = parseInt(localStorage.getItem('emojimachine.trollGambit'), 10) || 0; } catch (e) {}
        const isRecharging = (Date.now() - lastUsed) < TROLL_COOLDOWN;

        if (isRecharging) {
            trollFlavorEl.textContent = "The troll eyes you suspiciously. It's not in the mood right now. Give it some space and come back later.";
            trollActionsEl.hidden = true;
            trollContinueBtn.textContent = 'Back away slowly';
            trollContinueBtn.hidden = false;
            trollContinueBtn.onclick = closeTrollModal;
        } else {
            trollFlavorEl.textContent = 'The neon-haired troll leers at you from the side of the machine. It could bring great fortune… or it might just rob you blind. Such is the nature of trolls.';
            trollPokeBtn.onclick = pokeTroll;
            trollLeaveBtn.onclick = closeTrollModal;
        }

        trollModal.hidden = false;
        sfx.troll.stop();
        sfx.troll.play();
    }

    function closeTrollModal() {
        if (trollModal) trollModal.hidden = true;
    }

    function pokeTroll() {
        trollPokeBtn.disabled = true;
        trollLeaveBtn.disabled = true;
        try { localStorage.setItem('emojimachine.trollGambit', String(Date.now())); } catch (e) {}

        const coins = +coinsEl.textContent;
        const won   = Math.random() < 0.4; // 40% win, 60% lose

        // Animate the troll emoji
        trollEmojiEl.classList.remove('reacting');
        void trollEmojiEl.offsetWidth; // force reflow to restart animation
        trollEmojiEl.classList.add('reacting');

        setTimeout(() => {
            trollResultEl.hidden = false;
            if (won) {
                const gain     = Math.min(Math.max(Math.floor(coins * 0.25), 20), 10000);
                const newTotal = coins + gain;
                trollResultEl.className  = 'troll-modal__result success';
                trollResultTextEl.textContent = `The troll cackles and showers you with grubby coins! You gain ${gain} coins!`;
                sfx.epicWin.stop();
                sfx.epicWin.play();
                trollContinueBtn.textContent = 'Collect!';
                trollContinueBtn.hidden = false;
                trollContinueBtn.onclick = () => {
                    closeTrollModal();
                    countCoins(coins, newTotal, false, `+${gain} 🧌`);
                };
            } else {
                const lose     = Math.max(Math.floor(coins * 0.20), 10);
                const newTotal = Math.max(0, coins - lose);
                trollResultEl.className  = 'troll-modal__result failure';
                trollResultTextEl.textContent = `The troll SNARLS and swipes a fistful of your coins! You lose ${lose} coins.`;
                sfx.lose.play();
                trollContinueBtn.textContent = 'Slink away';
                trollContinueBtn.hidden = false;
                trollContinueBtn.onclick = () => {
                    closeTrollModal();
                    countCoins(coins, newTotal, false, `-${lose} 🧌`);
                };
            }
            trollActionsEl.hidden = true;
        }, 700);
    }

    // ── Cat's Walk ─────────────────────────────────────────────────────────────

    function openCatModal() {
        if (!catModal) return;
        // Reset state
        catImgEl.classList.remove('walking');
        catWalkingLabelEl.textContent = '';
        catResultEl.hidden = true;
        catResultEl.className = 'cat-modal__result';
        catResultTextEl.textContent = '';
        catActionsEl.hidden = false;
        catSendBtn.disabled = false;
        catLeaveBtn.disabled = false;
        catContinueBtn.hidden = true;
        catContinueBtn.textContent = '';

        let lastUsed = 0;
        try { lastUsed = parseInt(localStorage.getItem('emojimachine.catWalk'), 10) || 0; } catch (e) {}
        const isRecharging = (Date.now() - lastUsed) < CAT_COOLDOWN;

        if (isRecharging) {
            catFlavorEl.textContent = "The cat is curled up napping after its last walk around the arcade. Give it some rest and come back later.";
            catActionsEl.hidden = true;
            catContinueBtn.textContent = 'Leave it to nap';
            catContinueBtn.hidden = false;
            catContinueBtn.onclick = closeCatModal;
        } else {
            catFlavorEl.textContent = 'The ginger cat eyes the arcade corridors with curiosity. Send it on a walk and it might return with something good…';
            catSendBtn.onclick = sendCatOnWalk;
            catLeaveBtn.onclick = closeCatModal;
        }

        catModal.hidden = false;
        sfx.cat.stop();
        sfx.cat.play();
    }

    function closeCatModal() {
        if (catModal) catModal.hidden = true;
    }

    function sendCatOnWalk() {
        catSendBtn.disabled = true;
        catLeaveBtn.disabled = true;
        try { localStorage.setItem('emojimachine.catWalk', String(Date.now())); } catch (e) {}

        const prize = CAT_COIN_PRIZES[Math.floor(Math.random() * CAT_COIN_PRIZES.length)];

        // Animate the cat walking
        catImgEl.classList.add('walking');
        catWalkingLabelEl.textContent = '…off on a walk';
        catActionsEl.hidden = true;

        setTimeout(() => {
            catImgEl.classList.remove('walking');
            catWalkingLabelEl.textContent = '';
            catResultEl.hidden = false;
            catResultEl.className = 'cat-modal__result success';

            const coins    = +coinsEl.textContent;
            const newTotal = coins + prize;
            let resultMsg;
            if (prize >= 10000) {
                resultMsg = `The cat struts back draped in golden coins! An extraordinary haul — the cat brought back ${prize.toLocaleString()} coins!`;
                sfx.epicWin.stop();
                sfx.epicWin.play();
            } else if (prize >= 1000) {
                resultMsg = `The cat trots back with a heavy bag of coins! What incredible luck — ${prize.toLocaleString()} coins!`;
                sfx.epicWin.stop();
                sfx.epicWin.play();
            } else {
                resultMsg = `The cat pads back in and drops ${prize} coins at your feet. Good kitty!`;
                sfx.win.play();
            }
            catResultTextEl.textContent = resultMsg;

            catContinueBtn.textContent = 'Collect!';
            catContinueBtn.hidden = false;
            catContinueBtn.onclick = () => {
                closeCatModal();
                countCoins(coins, newTotal, false, `+${prize} 🐱`);
            };
        }, 1800);
    }

    // ── Win feature alternator ────────────────────────────────────────────────
    let lastWinFeature = 'higherLower'; // first spin-win will launch doubleOrNothing

    // ── Gamble helpers ────────────────────────────────────────────────────────

    function stopGambleFlicker() {
        if (gambleTimerId !== null) { clearInterval(gambleTimerId); gambleTimerId = null; }
    }

    function startGamble(winAmount, inheritSpeed) {
        gambleActive  = true;
        gambleCoins   = winAmount;
        gambleSpeed   = inheritSpeed !== undefined ? inheritSpeed : GAMBLE_BASE_SPEED;
        gambleLabel   = 'double';
        btnSpin.classList.remove('ready');
        btnCollect.classList.add('ready');
        flickerGamble();
    }

    function flickerGamble() {
        stopGambleFlicker();
        const labelHTML = () => {
            const option = gambleLabel === 'double'
                ? `💰 DOUBLE: +${gambleCoins * 2}`
                : '🪣 NOTHING';
            return `${option}<br><span style="font-size:0.6em;opacity:0.6">collect: +${gambleCoins}</span>`;
        };
        infoSpan.className = 'gamble';
        infoSpan.innerHTML = labelHTML();
        gambleTimerId = setInterval(() => {
            gambleLabel = gambleLabel === 'double' ? 'nothing' : 'double';
            infoSpan.innerHTML = labelHTML();
            sfx.bleep.stop();
            sfx.bleep.play();
        }, gambleSpeed);
        btnSpin.textContent = 'GAMBLE';
        btnSpin.classList.add('ready');
    }

    function resolveGamble() {
        stopGambleFlicker();
        const won = gambleLabel === 'double';
        gambleActive = false;
        btnCollect.classList.remove('ready');
        btnSpin.classList.remove('ready');
        if (won) {
            sfx.epicWin.stop();
            sfx.epicWin.play();
            gambleCoins *= 2;
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = `💰 DOUBLED! +${gambleCoins}`;
            const nextSpeed = gambleSpeed;
            setTimeout(() => startGamble(gambleCoins, nextSpeed), 900);
        } else {
            sfx.lose.play();
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = '🪣 NOTHING!';
            const coins = +coinsEl.textContent;
            if (coins >= 10) {
                setTimeout(() => {
                    btnSpin.textContent = 'Play';
                    checkRpgTrigger();
                    resetInfo = setTimeout(setReadyInfo, 3000);
                }, 1500);
            } else {
                rpgPending = false;
                setTimeout(() => setGameOver(), 1500);
            }
        }
    }

    function collectGamble() {
        stopGambleFlicker();
        gambleActive = false;
        btnCollect.classList.remove('ready');
        btnSpin.classList.remove('ready');
        btnSpin.textContent = 'Play';
        const oldCoins = +coinsEl.textContent;
        const newCoins = oldCoins + gambleCoins;
        countCoins(oldCoins, newCoins, true, 'Collected! 🤑');
        const wasAllSame = gamblePendingAllSame;
        gamblePendingAllSame = false;
        if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
        setTimeout(checkRpgTrigger, 2400);
    }

    // Cycle: Double-or-Nothing → Pick a Box → Spin the Wheel → Higher-or-Lower → repeat
    function startWinFeature(amount) {
        if (lastWinFeature === 'higherLower') {
            lastWinFeature = 'doubleOrNothing';
            startGamble(amount);
        } else if (lastWinFeature === 'doubleOrNothing') {
            lastWinFeature = 'pickABox';
            startPickABox(amount);
        } else if (lastWinFeature === 'pickABox') {
            lastWinFeature = 'spinTheWheel';
            startSpinTheWheel(amount);
        } else {
            lastWinFeature = 'higherLower';
            startHigherLower(amount);
        }
    }

    // ── Higher or Lower helpers ───────────────────────────────────────────────

    function updateNudgeButtonsHL() {
        nudgeBtns.forEach(btn => {
            btn.classList.toggle('hl-active', hlActive && +btn.dataset.wheel === 1);
        });
    }

    function showHLInfo() {
        infoSpan.className = 'hl-game';
        infoSpan.innerHTML =
            `Higher ▲ or Lower ▼? <span style="font-size:1.35em;color:#00e5ff;display:inline-block;min-width:1.5em;text-align:center">${hlCurrent}</span>` +
            `<br><span style="font-size:0.55em;opacity:0.65">numbers 1–10 &nbsp;·&nbsp; middle ▲▼ buttons &nbsp;·&nbsp; collect to bank: +${hlCoins}</span>`;
    }

    function startHigherLower(winAmount) {
        hlActive    = true;
        hlCoins     = winAmount;
        hlResolving = false;
        hlCurrent   = Math.ceil(Math.random() * 10);
        btnSpin.classList.remove('ready');
        btnCollect.classList.add('ready');
        updateNudgeButtonsHL();
        showHLInfo();
    }

    function resolveHigherLower(guess) {
        if (!hlActive || hlResolving) return;
        hlResolving = true;

        const next    = Math.ceil(Math.random() * 10);
        const correct = guess === 'higher' ? next > hlCurrent : next < hlCurrent;

        // Animate random number flicker for 2 seconds before revealing result
        const ANIM_DURATION = 2000;
        const ANIM_START    = performance.now();
        let   flickerTimer  = null;

        const tickFlicker = () => {
            const elapsed  = performance.now() - ANIM_START;
            const progress = Math.min(elapsed / ANIM_DURATION, 1);
            // Interval slows from 60 ms down to 160 ms as it approaches the end
            const interval = Math.round(60 + 100 * progress);
            const display  = elapsed >= ANIM_DURATION ? next : Math.ceil(Math.random() * 10);
            infoSpan.className = 'hl-game';
            infoSpan.innerHTML =
                `${guess === 'higher' ? '▲ Higher?' : '▼ Lower?'} <span style="font-size:1.35em;color:#00e5ff;display:inline-block;min-width:1.5em;text-align:center">${display}</span>` +
                `<br><span style="font-size:0.55em;opacity:0.65">collect to bank: +${hlCoins}</span>`;
            if (elapsed < ANIM_DURATION) {
                sfx.bleep.stop();
                sfx.bleep.play();
                flickerTimer = setTimeout(tickFlicker, interval);
            } else {
                finishResolve();
            }
        };

        const finishResolve = () => {
            if (correct) {
                sfx.epicWin.stop();
                sfx.epicWin.play();
                hlCoins  *= 2;
                hlCurrent = next;
                infoSpan.className = 'flash-fast';
                infoSpan.innerHTML = `✅ ${guess === 'higher' ? 'Higher' : 'Lower'}! It was ${next}! +${hlCoins}`;
                setTimeout(() => {
                    hlResolving = false;
                    if (hlActive) showHLInfo();
                }, 900);
            } else {
                hlActive    = false;
                hlResolving = false;
                updateNudgeButtonsHL();
                btnCollect.classList.remove('ready');
                const msg = next === hlCurrent
                    ? `🤝 Tie! Both ${next}! You lose! 💀`
                    : `❌ Wrong! It was ${next}! You lose! 💀`;
                sfx.lose.play();
                infoSpan.className = 'flash-fast';
                infoSpan.innerHTML = msg;
                const coins = +coinsEl.textContent;
                if (coins >= 10) {
                    setTimeout(() => {
                        checkRpgTrigger();
                        resetInfo = setTimeout(setReadyInfo, 3000);
                    }, 1500);
                } else {
                    setTimeout(() => setGameOver(), 1500);
                }
            }
        };

        tickFlicker();
    }

    function collectHigherLower() {
        hlActive    = false;
        hlResolving = false;
        updateNudgeButtonsHL();
        btnCollect.classList.remove('ready');
        btnSpin.classList.remove('ready');
        const oldCoins = +coinsEl.textContent;
        const newCoins = oldCoins + hlCoins;
        countCoins(oldCoins, newCoins, true, 'Collected! 🤑');
        const wasAllSame = gamblePendingAllSame;
        gamblePendingAllSame = false;
        if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
        setTimeout(checkRpgTrigger, 2400);
    }

    // ── Pick a Box helpers ────────────────────────────────────────────────────

    function updateHoldButtonsPB() {
        nudgeUpBtns.forEach(btn => {
            btn.classList.toggle('pb-active', pbActive && pbChosen === -1 && !pbResolving);
        });
    }

    function showPBInfo() {
        infoSpan.className = 'pb-game';
        infoSpan.innerHTML =
            `🎁 &nbsp; 🎁 &nbsp; 🎁 &nbsp; Pick a Box!` +
            `<br><span style="font-size:0.55em;opacity:0.65">nudge buttons &nbsp;·&nbsp; collect to bank: +${pbCoins}</span>`;
    }

    function startPickABox(winAmount) {
        pbActive    = true;
        pbCoins     = winAmount;
        pbChosen    = -1;
        pbResolving = false;
        // Shuffle three outcomes
        const outcomes = ['big', 'bank', 'lose'];
        for (let i = outcomes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
        }
        pbBoxes = outcomes;
        btnSpin.classList.remove('ready');
        btnCollect.classList.add('ready');
        updateHoldButtonsPB();
        showPBInfo();
    }

    function resolvePickABox(idx) {
        if (!pbActive || pbChosen !== -1 || pbResolving) return;
        pbChosen    = idx;
        pbResolving = true;
        updateHoldButtonsPB();
        btnCollect.classList.remove('ready');

        const outcome = pbBoxes[idx];
        const ANIM_DURATION = 1800;
        const ANIM_START    = performance.now();
        const EMOJIS        = ['🎁', '📦', '🎀', '🎲', '❓'];

        const buildReveal = () => pbBoxes.map((b, i) => {
            const e = b === 'big' ? '💰' : b === 'bank' ? '🤑' : '💀';
            return i === idx ? `<strong>${e}</strong>` : e;
        }).join(' &nbsp; ');

        const tickFlicker = () => {
            const elapsed  = performance.now() - ANIM_START;
            const progress = Math.min(elapsed / ANIM_DURATION, 1);
            const interval = Math.round(60 + 140 * progress);
            infoSpan.className = 'pb-game';
            infoSpan.innerHTML = `Opening box ${idx + 1}... ${EMOJIS[Math.floor(Math.random() * EMOJIS.length)]}`;
            sfx.bleep.stop();
            sfx.bleep.play();
            if (elapsed < ANIM_DURATION) {
                setTimeout(tickFlicker, interval);
            } else {
                finishReveal();
            }
        };

        const finishReveal = () => {
            pbActive    = false;
            pbResolving = false;
            updateHoldButtonsPB();
            const reveal = buildReveal();
            if (outcome === 'big') {
                const bigCoins = pbCoins * 3;
                sfx.epicWin.stop();
                sfx.epicWin.play();
                infoSpan.className = 'flash-fast';
                infoSpan.innerHTML = `💰 JACKPOT! ×3! +${bigCoins}!<br><span style="font-size:0.55em;opacity:0.7">${reveal}</span>`;
                const oldCoins = +coinsEl.textContent;
                const newCoins = oldCoins + bigCoins;
                setTimeout(() => {
                    countCoins(oldCoins, newCoins, true, `💰 +${bigCoins}!`);
                    const wasAllSame = gamblePendingAllSame;
                    gamblePendingAllSame = false;
                    if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
                    setTimeout(checkRpgTrigger, 2400);
                }, 1200);
            } else if (outcome === 'bank') {
                sfx.win.play();
                infoSpan.className = 'flash-fast';
                infoSpan.innerHTML = `🤑 Banked! +${pbCoins}!<br><span style="font-size:0.55em;opacity:0.7">${reveal}</span>`;
                const oldCoins = +coinsEl.textContent;
                const newCoins = oldCoins + pbCoins;
                setTimeout(() => {
                    countCoins(oldCoins, newCoins, true, `🤑 +${pbCoins}!`);
                    const wasAllSame = gamblePendingAllSame;
                    gamblePendingAllSame = false;
                    if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
                    setTimeout(checkRpgTrigger, 2400);
                }, 1200);
            } else {
                sfx.lose.play();
                infoSpan.className = 'flash-fast';
                infoSpan.innerHTML = `💀 Empty box! Nothing!<br><span style="font-size:0.55em;opacity:0.7">${reveal}</span>`;
                const coins = +coinsEl.textContent;
                if (coins >= 10) {
                    setTimeout(() => {
                        checkRpgTrigger();
                        resetInfo = setTimeout(setReadyInfo, 3000);
                    }, 1800);
                } else {
                    rpgPending = false;
                    setTimeout(() => setGameOver(), 1800);
                }
            }
        };

        tickFlicker();
    }

    function collectPickABox() {
        pbActive    = false;
        pbChosen    = -1;
        pbResolving = false;
        updateHoldButtonsPB();
        btnCollect.classList.remove('ready');
        btnSpin.classList.remove('ready');
        const oldCoins = +coinsEl.textContent;
        const newCoins = oldCoins + pbCoins;
        countCoins(oldCoins, newCoins, true, 'Collected! 🤑');
        const wasAllSame = gamblePendingAllSame;
        gamblePendingAllSame = false;
        if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
        setTimeout(checkRpgTrigger, 2400);
    }

    // ── Canvas helpers ────────────────────────────────────────────────────────

    // Sync canvas resolution, recompute responsive sizes, invalidate gradient cache.
    function syncCanvas() {
        const { width: cw, height: ch } = canvas.getBoundingClientRect();
        EMOJI_SIZE = Math.round(Math.max(28, Math.min(72, ch * 0.18)));
        ROW_HEIGHT = Math.round(EMOJI_SIZE * 1.35);
        WHEEL_GAP  = Math.round(Math.max(6, Math.min(24, cw * 0.02)));
        fontStr    = `${EMOJI_SIZE}px ${EMOJI_FONT_FAMILY}`;
        canvas.width  = cw * dpr;
        canvas.height = ch * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cachedGradients = null; // rebuilt on next draw
    }

    function buildGradients(W, H, wheelWidth) {
        cachedGradients = Array.from({ length: 3 }, (_, i) => {
            const x = i * (wheelWidth + WHEEL_GAP);
            const g = ctx.createLinearGradient(x, 0, x, H);
            g.addColorStop(0,    'rgba(12,7,21,0.55)');
            g.addColorStop(0.25, 'rgba(12,7,21,0)');
            g.addColorStop(0.75, 'rgba(12,7,21,0)');
            g.addColorStop(1,    'rgba(12,7,21,0.55)');
            return g;
        });
    }

    function drawCanvas() {
        const W = canvas.width  / dpr;
        const H = canvas.height / dpr;
        const wheelWidth = (W - WHEEL_GAP * 2) / 3;

        ctx.clearRect(0, 0, W, H);
        // Dark background visible in gaps between reels
        ctx.fillStyle = '#0b0520';
        ctx.fillRect(0, 0, W, H);
        if (!cachedGradients) buildGradients(W, H, wheelWidth);

        for (let i = 0; i < 3; i++) {
            const x      = i * (wheelWidth + WHEEL_GAP);
            const cx     = x + wheelWidth / 2;
            const offset = wheelOffsets[i];
            const reel   = roll[i];

            ctx.save();
            ctx.beginPath();
            ctx.rect(x, 0, wheelWidth, H);
            ctx.clip();

            // Neon-backlit reel background
            const reelBg = ctx.createLinearGradient(x, 0, x + wheelWidth, 0);
            reelBg.addColorStop(0,    '#cff3ff');
            reelBg.addColorStop(0.15, '#edfaff');
            reelBg.addColorStop(0.5,  '#ffffff');
            reelBg.addColorStop(0.85, '#ffeeff');
            reelBg.addColorStop(1,    '#ffd0ff');
            ctx.fillStyle = reelBg;
            ctx.fillRect(x, 0, wheelWidth, H);

            ctx.font         = fontStr;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            // Safari can drop emoji glyphs in canvas when filters are active.
            if (wheelSpinning[i] && !IS_SAFARI) ctx.filter = 'blur(1.5px)';
            ctx.fillStyle = '#0f0b1f';

            const halfH = H / 2;
            for (let j = 0; j < reel.length; j++) {
                const y = halfH + (j - ACTIVE_ROW) * ROW_HEIGHT + offset;
                if (y > -ROW_HEIGHT && y < H + ROW_HEIGHT) ctx.fillText(reel[j], cx, y);
            }

            ctx.filter    = 'none';
            ctx.fillStyle = cachedGradients[i];
            ctx.fillRect(x, 0, wheelWidth, H);
            ctx.restore();
        }

        // Neon glow in gaps between reels
        ctx.save();
        ctx.shadowBlur  = 20;
        ctx.shadowColor = '#00e5ff';
        for (let g = 0; g < 2; g++) {
            const gapX = wheelWidth + g * (wheelWidth + WHEEL_GAP);
            ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
            ctx.fillRect(gapX, 0, WHEEL_GAP, H);
        }
        ctx.restore();

        // Centre-row indicator lines with neon glow
        const centerY = H / 2 - ROW_HEIGHT / 2;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 26, 255, 0.75)';
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = 'rgba(255, 26, 255, 0.9)';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.moveTo(0, centerY);              ctx.lineTo(W, centerY);
        ctx.moveTo(0, centerY + ROW_HEIGHT); ctx.lineTo(W, centerY + ROW_HEIGHT);
        ctx.stroke();
        ctx.restore();
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let lastFrameTime = 0;
    let rafId = null;

    function startLoop() {
        if (rafId !== null) return;
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(animationLoop);
    }

    function animationLoop(timestamp) {
        rafId = null;
        const dt = Math.min(timestamp - lastFrameTime, 50); // cap to avoid jump after tab switch
        lastFrameTime = timestamp;
        for (let i = 0; i < 3; i++) {
            const off = wheelOffsets[i];
            if (off < 0)      wheelOffsets[i] = Math.min(0, off + ROW_HEIGHT * dt / spinSpeeds[i]);
            else if (off > 0) wheelOffsets[i] = Math.max(0, off - ROW_HEIGHT * dt / spinSpeeds[i]);
        }
        drawCanvas();
        if (wheelSpinning.some(Boolean) || wheelOffsets.some(o => o !== 0)) {
            rafId = requestAnimationFrame(animationLoop);
        }
    }

    // ── Win Explosion Effect (Vampire Survivors style) ────────────────────────
    const expCanvas = document.getElementById('explosion-canvas');
    const expCtx    = expCanvas.getContext('2d');

    // Warm white/gold core beams + vivid accent sparks
    const BEAM_COLORS  = ['#ffffff', '#fff7aa', '#ffe135', '#ffaa00', '#ffd60a', '#fffde0', '#ffe86e', '#ffcc00'];
    const SPARK_COLORS = [
        '#ffffff', '#ffe135', '#ff6b35', '#ff2d55',
        '#bf5af2', '#5ac8fa', '#30d158', '#ffd60a',
        '#64d2ff', '#ff9f0a', '#c77dff', '#00e5ff',
    ];

    let expParticles  = [];
    let expRings      = [];
    let expGlow       = 0;
    let expGlowOrigin = { x: 0, y: 0 };
    let expAnimId     = null;
    let expFrame      = 0;
    let expStartTime  = 0;
    let expLastTime   = 0;

    function resizeExplosionCanvas() {
        expCanvas.width  = Math.round(window.innerWidth  * dpr);
        expCanvas.height = Math.round(window.innerHeight * dpr);
        expCanvas.style.width  = window.innerWidth  + 'px';
        expCanvas.style.height = window.innerHeight + 'px';
        expCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resizeExplosionCanvas);
    resizeExplosionCanvas();

    // ── Spin the Wheel canvas ─────────────────────────────────────────────────
    const swCanvas = document.getElementById('wheel-canvas');
    const swCtx    = swCanvas.getContext('2d');

    function resizeWheelCanvas() {
        swCanvas.width  = Math.round(window.innerWidth  * dpr);
        swCanvas.height = Math.round(window.innerHeight * dpr);
        swCanvas.style.width  = window.innerWidth  + 'px';
        swCanvas.style.height = window.innerHeight + 'px';
        swCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeWheelCanvas);
    resizeWheelCanvas();

    function drawWheel() {
        const W  = window.innerWidth;
        const H  = window.innerHeight;
        const cx = W / 2;
        const cy = H / 2;
        const radius   = Math.min(W, H) * 0.38;
        const n        = SW_SEGMENTS.length;
        const segAngle = (Math.PI * 2) / n;

        swCtx.clearRect(0, 0, W, H);

        // ── CRT background ───────────────────────────────────────────────────
        swCtx.fillStyle = 'rgba(8, 6, 20, 0.97)';
        swCtx.fillRect(0, 0, W, H);

        // Scanlines
        for (let y = 0; y < H; y += 4) {
            swCtx.fillStyle = 'rgba(0, 0, 0, 0.40)';
            swCtx.fillRect(0, y, W, 2);
        }

        // CRT vignette
        const vig = swCtx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, W * 0.8);
        vig.addColorStop(0, 'transparent');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
        swCtx.fillStyle = vig;
        swCtx.fillRect(0, 0, W, H);

        // ── Wheel segments ───────────────────────────────────────────────────
        // Pre-compute shared radial depth gradient
        const rg = swCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        rg.addColorStop(0.0, 'rgba(255,255,255,0.16)');
        rg.addColorStop(1.0, 'rgba(0,0,0,0.28)');

        for (let i = 0; i < n; i++) {
            const startSeg = swAngle + i * segAngle;
            const endSeg   = swAngle + (i + 1) * segAngle;
            const mid      = startSeg + segAngle / 2;

            // Solid colour fill
            swCtx.beginPath();
            swCtx.moveTo(cx, cy);
            swCtx.arc(cx, cy, radius, startSeg, endSeg);
            swCtx.closePath();
            swCtx.fillStyle = SW_COLORS[i];
            swCtx.fill();

            // Radial depth overlay
            swCtx.beginPath();
            swCtx.moveTo(cx, cy);
            swCtx.arc(cx, cy, radius, startSeg, endSeg);
            swCtx.closePath();
            swCtx.fillStyle = rg;
            swCtx.fill();

            // Thick black segment divider
            swCtx.shadowBlur  = 0;
            swCtx.beginPath();
            swCtx.moveTo(cx, cy);
            swCtx.lineTo(cx + Math.cos(startSeg) * radius, cy + Math.sin(startSeg) * radius);
            swCtx.strokeStyle = '#000000';
            swCtx.lineWidth   = 5;
            swCtx.stroke();

            // Labels
            const lx      = cx + Math.cos(mid) * radius * 0.64;
            const ly      = cy + Math.sin(mid) * radius * 0.64;
            const emojiSz = Math.round(radius * 0.195);
            const lblSz   = Math.round(radius * 0.115);
            swCtx.save();
            swCtx.translate(lx, ly);
            swCtx.textAlign    = 'center';
            swCtx.textBaseline = 'middle';

            // Emoji with phosphor glow
            swCtx.shadowBlur  = 8;
            swCtx.shadowColor = 'rgba(255,255,255,0.80)';
            swCtx.font        = `${emojiSz}px ${EMOJI_FONT_FAMILY}`;
            swCtx.fillStyle   = '#ffffff';
            swCtx.fillText(SW_SEGMENTS[i].emoji, 0, -lblSz * 0.9);

            // Label: black outline then bright white fill
            swCtx.font        = `bold ${lblSz}px "Courier New", monospace`;
            swCtx.lineWidth   = 3;
            swCtx.strokeStyle = '#000000';
            swCtx.shadowBlur  = 0;
            swCtx.strokeText(SW_SEGMENTS[i].label, 0, emojiSz * 0.65);
            swCtx.shadowBlur  = 6;
            swCtx.shadowColor = 'rgba(255,255,255,0.90)';
            swCtx.fillStyle   = '#ffffff';
            swCtx.fillText(SW_SEGMENTS[i].label, 0, emojiSz * 0.65);

            swCtx.restore();
        }

        // ── Outer rim: chrome multi-ring ─────────────────────────────────────
        // Inner black boundary
        swCtx.shadowBlur  = 0;
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        swCtx.strokeStyle = '#111111';
        swCtx.lineWidth   = 3;
        swCtx.stroke();

        // Thick dark rim band
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius + 9, 0, Math.PI * 2);
        swCtx.strokeStyle = '#1a0a2e';
        swCtx.lineWidth   = 18;
        swCtx.stroke();

        // Subtle cyan gloss arc
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius + 9, -Math.PI * 0.9, -Math.PI * 0.05);
        swCtx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
        swCtx.lineWidth   = 4;
        swCtx.shadowBlur  = 6;
        swCtx.shadowColor = '#00e5ff';
        swCtx.stroke();
        swCtx.shadowBlur  = 0;

        // Neon cyan inner ring
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius + 15, 0, Math.PI * 2);
        swCtx.strokeStyle = '#00e5ff';
        swCtx.lineWidth   = 2;
        swCtx.shadowBlur  = 14;
        swCtx.shadowColor = '#00e5ff';
        swCtx.stroke();
        swCtx.shadowBlur  = 0;

        // Neon magenta outer ring
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
        swCtx.strokeStyle = '#ff1aff';
        swCtx.lineWidth   = 3;
        swCtx.shadowBlur  = 20;
        swCtx.shadowColor = '#ff1aff';
        swCtx.stroke();
        swCtx.shadowBlur  = 0;

        // Neon cyan square studs at segment dividers
        for (let i = 0; i < n; i++) {
            const angle = swAngle + i * segAngle;
            const sx    = cx + Math.cos(angle) * (radius + 9);
            const sy    = cy + Math.sin(angle) * (radius + 9);
            swCtx.save();
            swCtx.translate(sx, sy);
            swCtx.rotate(angle);
            swCtx.fillStyle   = '#00e5ff';
            swCtx.shadowBlur  = 8;
            swCtx.shadowColor = '#00e5ff';
            swCtx.fillRect(-4.5, -4.5, 9, 9);
            swCtx.shadowBlur  = 0;
            swCtx.restore();
        }

        // ── Centre hub ───────────────────────────────────────────────────────
        swCtx.beginPath();
        swCtx.arc(cx, cy, radius * 0.11, 0, Math.PI * 2);
        swCtx.fillStyle   = '#ff1aff';
        swCtx.shadowBlur  = 18;
        swCtx.shadowColor = '#ff1aff';
        swCtx.fill();
        swCtx.shadowBlur  = 0;

        swCtx.beginPath();
        swCtx.arc(cx, cy, radius * 0.075, 0, Math.PI * 2);
        swCtx.fillStyle = '#0a0020';
        swCtx.fill();

        swCtx.beginPath();
        swCtx.arc(cx, cy, radius * 0.042, 0, Math.PI * 2);
        swCtx.fillStyle   = '#00e5ff';
        swCtx.shadowBlur  = 10;
        swCtx.shadowColor = '#00e5ff';
        swCtx.fill();
        swCtx.shadowBlur  = 0;

        // ── Pointer ──────────────────────────────────────────────────────────
        const pSz    = radius * 0.12;
        const pYtip  = cy - radius - 3;
        const pYbase = cy - radius - pSz * 2.1;

        // Drop shadow
        swCtx.beginPath();
        swCtx.moveTo(cx + 3, pYtip + 5);
        swCtx.lineTo(cx - pSz * 0.65 + 3, pYbase + 5);
        swCtx.lineTo(cx + pSz * 0.65 + 3, pYbase + 5);
        swCtx.closePath();
        swCtx.fillStyle = 'rgba(0,0,0,0.55)';
        swCtx.fill();

        // Pointer fill (hot-magenta neon)
        swCtx.beginPath();
        swCtx.moveTo(cx, pYtip);
        swCtx.lineTo(cx - pSz * 0.65, pYbase);
        swCtx.lineTo(cx + pSz * 0.65, pYbase);
        swCtx.closePath();
        swCtx.fillStyle   = '#ff1aff';
        swCtx.shadowBlur  = 22;
        swCtx.shadowColor = '#ff1aff';
        swCtx.fill();

        // Pointer outline
        swCtx.shadowBlur  = 0;
        swCtx.beginPath();
        swCtx.moveTo(cx, pYtip);
        swCtx.lineTo(cx - pSz * 0.65, pYbase);
        swCtx.lineTo(cx + pSz * 0.65, pYbase);
        swCtx.closePath();
        swCtx.strokeStyle = '#ffffff';
        swCtx.lineWidth   = 2;
        swCtx.stroke();

        // ── "SPIN THE WHEEL" title ────────────────────────────────────────────
        const titleSz = Math.max(12, Math.round(radius * 0.095));
        const titleY  = Math.max(titleSz + 6, pYbase - titleSz * 1.8);
        swCtx.save();
        swCtx.textAlign    = 'center';
        swCtx.textBaseline = 'middle';
        swCtx.font         = `bold ${titleSz}px "Courier New", monospace`;
        swCtx.shadowBlur   = 22;
        swCtx.shadowColor  = '#ff1aff';
        swCtx.fillStyle    = '#ff1aff';
        swCtx.fillText('★  SPIN  THE  WHEEL  ★', cx, titleY);
        swCtx.shadowBlur   = 0;
        swCtx.fillStyle    = '#e080ff';
        swCtx.fillText('★  SPIN  THE  WHEEL  ★', cx, titleY);
        swCtx.restore();
    }

    function startSpinTheWheel(winAmount) {
        swActive   = true;
        swCoins    = winAmount;
        swSpinning = false;
        swAngle    = 0;
        btnSpin.textContent = 'SPIN!';
        btnSpin.classList.add('ready');
        btnCollect.classList.add('ready');
        infoSpan.className = 'sw-game';
        infoSpan.innerHTML =
            `🎡 Spin the Wheel!` +
            `<br><span style="font-size:0.55em;opacity:0.65">SPIN for a ×3 chance · collect to bank: +${swCoins}</span>`;
    }

    function doSpinWheel() {
        if (!swActive || swSpinning) return;
        swSpinning = true;
        btnSpin.classList.remove('ready');
        btnCollect.classList.remove('ready');
        resizeWheelCanvas();
        swCanvas.classList.add('active');
        drawWheel();
        sfx.spinner.play();

        // Weighted random outcome
        const weights = SW_SEGMENTS.map(s =>
            s.type === 'mult' && s.value === 2 ? 3 : s.type === 'lose' ? 2 : 1
        );
        const totalW = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalW;
        let winSeg = 0;
        for (let i = 0; i < weights.length; i++) {
            rand -= weights[i];
            if (rand <= 0) { winSeg = i; break; }
        }

        const n        = SW_SEGMENTS.length;
        const segAngle = (Math.PI * 2) / n;
        const extra    = 5 + Math.floor(Math.random() * 4); // 5–8 extra full rotations
        // Target: centre of winSeg under the pointer (pointer sits at angle -π/2, i.e. top)
        let targetAngle = -Math.PI / 2 - (winSeg + 0.5) * segAngle;
        const minTarget = swAngle + extra * Math.PI * 2;
        while (targetAngle < minTarget) targetAngle += Math.PI * 2;

        const startAngle = swAngle;
        const delta      = targetAngle - startAngle;
        const DURATION   = 3600; // ms
        const t0         = performance.now();

        const animate = now => {
            const elapsed = now - t0;
            const t       = Math.min(elapsed / DURATION, 1);
            swAngle       = startAngle + delta * (1 - Math.pow(1 - t, 3)); // cubic ease-out
            drawWheel();
            if (t < 1) {
                swAnimId = requestAnimationFrame(animate);
            } else {
                swAngle  = targetAngle;
                swAnimId = null;
                drawWheel();
                sfx.spinner.stop();
                setTimeout(() => resolveSpinTheWheel(winSeg), 500);
            }
        };
        swAnimId = requestAnimationFrame(animate);
    }

    function resolveSpinTheWheel(winSeg) {
        const seg = SW_SEGMENTS[winSeg];
        swSpinning = false;
        if (swAnimId) { cancelAnimationFrame(swAnimId); swAnimId = null; }
        swCanvas.classList.remove('active');
        swActive = false;
        btnSpin.textContent = 'Play';
        if (seg.type === 'mult') {
            const won = Math.round(swCoins * seg.value);
            sfx.epicWin.stop();
            sfx.epicWin.play();
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = `🎡 ${seg.emoji} ${seg.label}! +${won}`;
            const oldCoins = +coinsEl.textContent;
            const newCoins = oldCoins + won;
            setTimeout(() => {
                countCoins(oldCoins, newCoins, true, `${seg.emoji} +${won}`);
                const wasAllSame = gamblePendingAllSame;
                gamblePendingAllSame = false;
                if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
                setTimeout(checkRpgTrigger, 2400);
            }, 900);
        } else if (seg.type === 'bank') {
            sfx.win.play();
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = `🎡 🤑 Banked! +${swCoins}`;
            const oldCoins = +coinsEl.textContent;
            const newCoins = oldCoins + swCoins;
            setTimeout(() => {
                countCoins(oldCoins, newCoins, true, `🤑 +${swCoins}`);
                const wasAllSame = gamblePendingAllSame;
                gamblePendingAllSame = false;
                if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
                setTimeout(checkRpgTrigger, 2400);
            }, 900);
        } else {
            sfx.lose.play();
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = '🎡 💀 Wheel of Doom! Nothing!';
            const coins = +coinsEl.textContent;
            if (coins >= 10) {
                setTimeout(() => {
                    checkRpgTrigger();
                    resetInfo = setTimeout(setReadyInfo, 3000);
                }, 1800);
            } else {
                rpgPending = false;
                setTimeout(() => setGameOver(), 1800);
            }
        }
    }

    function collectSpinTheWheel() {
        if (swAnimId) { cancelAnimationFrame(swAnimId); swAnimId = null; }
        swCanvas.classList.remove('active');
        swActive   = false;
        swSpinning = false;
        btnCollect.classList.remove('ready');
        btnSpin.classList.remove('ready');
        btnSpin.textContent = 'Play';
        const oldCoins = +coinsEl.textContent;
        const newCoins = oldCoins + swCoins;
        countCoins(oldCoins, newCoins, true, 'Collected! 🤑');
        const wasAllSame = gamblePendingAllSame;
        gamblePendingAllSame = false;
        if (newCoins >= 10 && !wasAllSame) offerHolds(gamblePendingPair);
        setTimeout(checkRpgTrigger, 2400);
    }

    function triggerWinExplosion(emoji, epic) {
        const rect = canvas.getBoundingClientRect();
        const ox   = rect.left + rect.width  / 2;
        const oy   = rect.top  + rect.height / 2;

        expParticles  = [];
        expRings      = [];
        expGlow       = 1;
        expGlowOrigin = { x: ox, y: oy };
        expFrame      = 0;

        // ── Light beams ── long glowing rays shooting straight out ─────────
        const beamCount = epic ? 20 : 12;
        for (let i = 0; i < beamCount; i++) {
            const angle = (i / beamCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
            const speed = ((epic ? 22 : 16) + Math.random() * 14) * 60;
            expParticles.push({
                type: 'beam',
                x: ox, y: oy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1, decay: 0.42 + Math.random() * 0.36,
                beamLen: (epic ? 170 : 110) + Math.random() * 90,
                width: (epic ? 3.5 : 2.5) + Math.random() * 2,
                color: BEAM_COLORS[i % BEAM_COLORS.length],
            });
        }

        // ── Sparkle orbs ── vivid glowing dots flying straight out ─────────
        const sparkCount = epic ? 80 : 50;
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (5 + Math.random() * (epic ? 24 : 18)) * 60;
            expParticles.push({
                type: 'orb',
                x: ox, y: oy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1, decay: 0.72 + Math.random() * 1.08,
                size: 2.5 + Math.random() * 7,
                color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
            });
        }

        // ── Emoji projectiles ── winning emoji firing outward like VS shots ─
        const emojiCount = epic ? 24 : 14;
        for (let i = 0; i < emojiCount; i++) {
            const angle = (i / emojiCount) * Math.PI * 2;
            const speed = ((epic ? 13 : 9) + Math.random() * 10) * 60;
            const sz    = 30 + Math.random() * (epic ? 36 : 24);
            expParticles.push({
                type: 'emoji',
                x: ox, y: oy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1, decay: 0.30 + Math.random() * 0.36,
                size: sz, emoji,
                rot: Math.random() * Math.PI * 2,
                rotSpd: (Math.random() - 0.5) * 13.2,
                trail: [],
            });
        }

        // ── Shockwave rings ── timed to stagger outward like VS level-up ───
        // delays are now in seconds; speeds are now pixels per second
        const ringDefs = epic
            ? [{ delay: 0,     speed: 1200, col: '#ffffff', w: 6 },
               { delay: 0.1,   speed: 1500, col: '#ffe135', w: 4 },
               { delay: 0.217, speed: 1080, col: '#5ac8fa', w: 3 },
               { delay: 0.35,  speed: 1320, col: '#bf5af2', w: 3 }]
            : [{ delay: 0,     speed: 960,  col: '#ffffff', w: 5 },
               { delay: 0.117, speed: 1200, col: '#ffe135', w: 3 },
               { delay: 0.25,  speed: 840,  col: '#5ac8fa', w: 2 }];
        for (const def of ringDefs) {
            expRings.push({
                x: ox, y: oy, r: 0,
                delay: def.delay,
                speed: def.speed,
                life: 1, decay: 0.66,
                color: def.col, width: def.w,
            });
        }

        expStartTime = 0;
        expLastTime  = 0;
        if (expAnimId) cancelAnimationFrame(expAnimId);
        expAnimId = requestAnimationFrame(animateExplosion);
    }

    function animateExplosion(timestamp) {
        if (!expStartTime) { expStartTime = timestamp; expLastTime = timestamp; }
        const dt      = Math.min((timestamp - expLastTime) / 1000, 0.05); // cap at 50 ms
        expLastTime   = timestamp;
        const elapsed = (timestamp - expStartTime) / 1000;

        const W = window.innerWidth;
        const H = window.innerHeight;
        expCtx.clearRect(0, 0, W, H);

        let alive = false;

        // ── Radial bloom glow at origin ────────────────────────────────────
        if (expGlow > 0) {
            alive = true;
            const { x, y } = expGlowOrigin;
            const radius = 140 + (1 - expGlow) * 100;
            const grad = expCtx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0,   `rgba(255,255,230,${expGlow * 0.95})`);
            grad.addColorStop(0.25, `rgba(255,225,53, ${expGlow * 0.7})`);
            grad.addColorStop(0.6,  `rgba(255,100,0,  ${expGlow * 0.25})`);
            grad.addColorStop(1,    'rgba(0,0,0,0)');
            expCtx.save();
            expCtx.fillStyle = grad;
            // Fill only the bloom area, not the whole canvas
            expCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            expCtx.restore();
            expGlow = Math.max(0, expGlow - 3.6 * dt);
        }

        // ── Shockwave rings ────────────────────────────────────────────────
        for (const ring of expRings) {
            if (elapsed < ring.delay) { alive = true; continue; }
            if (ring.life <= 0) continue;
            alive = true;
            ring.r   += ring.speed * dt;
            ring.life = Math.max(0, ring.life - ring.decay * dt);
            expCtx.save();
            expCtx.globalAlpha = Math.pow(ring.life, 0.65);
            expCtx.strokeStyle = ring.color;
            expCtx.lineWidth   = Math.max(0.5, ring.width * ring.life);
            expCtx.beginPath();
            expCtx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
            expCtx.stroke();
            expCtx.restore();
        }

        // ── Particles ─────────────────────────────────────────────────────
        for (const p of expParticles) {
            if (p.life <= 0) continue;
            alive = true;

            // Straight-line travel — no gravity, no drag
            p.x   += p.vx * dt;
            p.y   += p.vy * dt;
            p.life = Math.max(0, p.life - p.decay * dt);
            const alpha = Math.pow(p.life, 0.55);

            expCtx.save();
            expCtx.globalAlpha = alpha;

            if (p.type === 'beam') {
                const spd  = Math.hypot(p.vx, p.vy) || 1;
                const nx   = p.vx / spd;
                const ny   = p.vy / spd;
                const tailX = p.x - nx * p.beamLen;
                const tailY = p.y - ny * p.beamLen;

                expCtx.lineCap     = 'round';
                expCtx.strokeStyle = p.color;
                expCtx.lineWidth   = Math.max(0.5, p.width * p.life);
                expCtx.beginPath();
                expCtx.moveTo(p.x, p.y);
                expCtx.lineTo(tailX, tailY);
                expCtx.stroke();

            } else if (p.type === 'orb') {
                expCtx.fillStyle = p.color;
                expCtx.beginPath();
                expCtx.arc(p.x, p.y, Math.max(0.5, p.size * Math.pow(p.life, 0.3)), 0, Math.PI * 2);
                expCtx.fill();

            } else if (p.type === 'emoji') {
                if (p.rot !== undefined) p.rot += p.rotSpd * dt;
                // Light trail
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 5) p.trail.shift();
                for (let t = 0; t < p.trail.length; t++) {
                    const tp = p.trail[t];
                    expCtx.globalAlpha  = (t / p.trail.length) * alpha * 0.3;
                    expCtx.font         = `${p.size * 0.55}px ${EMOJI_FONT_FAMILY}`;
                    expCtx.textAlign    = 'center';
                    expCtx.textBaseline = 'middle';
                    expCtx.fillText(p.emoji, tp.x, tp.y);
                }
                expCtx.globalAlpha  = alpha;
                expCtx.translate(p.x, p.y);
                expCtx.rotate(p.rot);
                expCtx.font         = `${p.size}px ${EMOJI_FONT_FAMILY}`;
                expCtx.textAlign    = 'center';
                expCtx.textBaseline = 'middle';
                expCtx.fillText(p.emoji, 0, 0);
            }

            expCtx.restore();
        }

        if (alive) {
            expAnimId = requestAnimationFrame(animateExplosion);
        } else {
            expAnimId = null;
            expCtx.clearRect(0, 0, W, H);
        }
    }

    // ── Wheel manipulation ────────────────────────────────────────────────────
    // Advance reel: item above centre becomes centre (scroll down)
    const advanceReel = i => { roll[i].unshift(roll[i].pop());  wheelOffsets[i] -= ROW_HEIGHT; startLoop(); };
    // Retreat reel: item below centre becomes centre (scroll up)
    const retreatReel = i => { roll[i].push(roll[i].shift());   wheelOffsets[i] += ROW_HEIGHT; startLoop(); };

    // ── UI helpers ────────────────────────────────────────────────────────────
    function setReadyInfo() {
        infoSpan.className = 'flash';
        infoSpan.innerHTML = `<img src="img/coin_color.svg" alt="coin" class="score-coin"> ${coinsEl.textContent}`;
    }

    function setGameOver() {
        clearTimeout(resetInfo);
        stopGambleFlicker();
        gambleActive = false;
        hlActive     = false;
        hlResolving  = false;
        pbActive     = false;
        pbChosen     = -1;
        pbResolving  = false;
        if (swAnimId) { cancelAnimationFrame(swAnimId); swAnimId = null; }
        swCanvas.classList.remove('active');
        swActive   = false;
        swSpinning = false;
        updateNudgeButtonsHL();
        updateHoldButtonsPB();
        btnCollect.classList.remove('ready');
        sfx.gameOver.play();
        infoSpan.className = 'gameover';
        infoSpan.innerHTML = 'GAME OVER! 💀';
        btnSpin.className  = 'btn gameover';
        const gameOverModal = document.getElementById('game-over-modal');
        gameOverModal.removeAttribute('hidden');
        requestAnimationFrame(() => gameOverModal.classList.add('game-over-modal--in'));
    }

    function setWinner() {
        clearTimeout(resetInfo);
        stopGambleFlicker();
        gambleActive = false;
        hlActive     = false;
        hlResolving  = false;
        pbActive     = false;
        pbChosen     = -1;
        pbResolving  = false;
        if (swAnimId) { cancelAnimationFrame(swAnimId); swAnimId = null; }
        swCanvas.classList.remove('active');
        swActive   = false;
        swSpinning = false;
        updateNudgeButtonsHL();
        updateHoldButtonsPB();
        btnCollect.classList.remove('ready');
        sfx.epicWin.play();
        infoSpan.className = 'flash';
        infoSpan.innerHTML = '🏆 MILLIONAIRE! 🏆';
        btnSpin.className  = 'btn gameover';
        const winnerModal = document.getElementById('winner-modal');
        winnerModal.removeAttribute('hidden');
        requestAnimationFrame(() => winnerModal.classList.add('winner-modal--in'));
    }

    function updateHoldButtons() {
        holdBtns.forEach((btn, i) => {
            btn.classList.toggle('held',     wheelsHeld[i]);
            btn.classList.toggle('holdable', wheelsHoldable[i] && !wheelsHeld[i]);
        });
    }

    const updateNudgeButtons = () =>
        nudgeBtns.forEach(btn => btn.classList.toggle('nudgeable', nudgesActive));

    // ── Hold logic ────────────────────────────────────────────────────────────
    function offerHolds(twoMatch) {
        if (currentHoldProb === null || lastOfferTwoMatch !== twoMatch) {
            currentHoldProb   = twoMatch ? BASE_HOLD_PROB.twoMatch : BASE_HOLD_PROB.noMatch;
            lastOfferTwoMatch = twoMatch;
        }
        const offered = Math.random() < currentHoldProb;
        wheelsHoldable.fill(offered);
        updateHoldButtons();
        if (!offered) currentHoldProb = twoMatch ? BASE_HOLD_PROB.twoMatch : BASE_HOLD_PROB.noMatch;
    }

    // ── Coin counter animation ────────────────────────────────────────────────
    // afterSpin: true when called after a spin result, false for the initial debit
    function countCoins(oldCoins, newCoins, afterSpin, msg) {
        if (msg) {
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = msg;
        }

        const showCount = n => {
            infoSpan.className = 'score';
            infoSpan.innerHTML = `<img src="img/coin_color.svg" alt="coin" class="score-coin"> ${n}`;
            try { localStorage.setItem('emojimachine.coins', String(n)); } catch (e) { /* ignore */ }
        };

        const countStep = diff => diff >= 100000 ? 10000 : diff >= 10000 ? 1000 : diff >= 1000 ? 100 : diff >= 100 ? 10 : 1;

        if (afterSpin && newCoins <= 0) {
            if (oldCoins > 0) {
                const downTotal = oldCoins;
                const step = countStep(downTotal);
                const downDelay = Math.round(Math.max(8, Math.min(100, 2000 / (downTotal / step))));
                const id = setInterval(() => {
                    sfx.coinDown.play();
                    oldCoins = Math.max(0, oldCoins - step);
                    coinsEl.textContent = oldCoins;
                    showCount(oldCoins);
                    if (oldCoins === 0) clearInterval(id);
                }, downDelay);
            }
            setGameOver();
        } else if (oldCoins > newCoins) {
            const downTotal = oldCoins - newCoins;
            const step = countStep(downTotal);
            const downDelay = Math.round(Math.max(8, Math.min(100, 2000 / (downTotal / step))));
            const id = setInterval(() => {
                sfx.coinDown.play();
                oldCoins = Math.max(newCoins, oldCoins - step);
                coinsEl.textContent = oldCoins;
                showCount(oldCoins);
                if (oldCoins === newCoins || oldCoins === 0) {
                    clearInterval(id);
                    if (afterSpin && newCoins < 10) setGameOver();
                }
            }, downDelay);
        } else {
            // Win — speed scales with total: large wins tick much faster
            const total = newCoins - oldCoins;
            const step = countStep(total);
            const ticks = total / step;
            const START_DELAY = Math.round(Math.max(8,  Math.min(100, 2000 / ticks)));
            const END_DELAY   = Math.round(Math.max(4,  START_DELAY / 4));
            let tickCount = 0;
            const tick = () => {
                sfx.coinUp.play();
                oldCoins = Math.min(newCoins, oldCoins + step);
                coinsEl.textContent = oldCoins;
                showCount(oldCoins);
                tickCount++;
                if (oldCoins === newCoins) {
                    if (newCoins >= 1000000) setTimeout(() => setWinner(), 500);
                    return;
                }
                const progress = ticks > 1 ? tickCount / (ticks - 1) : 1;
                setTimeout(tick, Math.round(START_DELAY + (END_DELAY - START_DELAY) * progress));
            };
            setTimeout(tick, START_DELAY);
        }

        if (afterSpin && newCoins >= 10 && newCoins < 1000000) {
            resetInfo = setTimeout(() => {
                setReadyInfo();
                checkRpgTrigger();
            }, 3000);
        }
    }

    // ── Spin result ───────────────────────────────────────────────────────────
    function processSpinResult() {
        const coins    = +coinsEl.textContent;
        const c        = [roll[0][3], roll[1][3], roll[2][3]];
        const allSame  = c[0] === c[1] && c[1] === c[2];
        const firstTwo = c[0] === c[1];
        const anyPair  = firstTwo || c[0] === c[2] || c[1] === c[2];

        // Skull — 3 skulls: instant death; 2 skulls: nothing happens
        if (allSame && c[0] === '💀') {
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = '💀 INSTANT DEATH! 💀';
            rpgPending = false; // game ends, cancel any pending event
            setTimeout(() => setGameOver(), 1500);
            return;
        }
        if (firstTwo && c[0] === '💀') {
            sfx.lose.play();
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = '💀 Two skulls... lucky escape!';
            if (coins >= 10) {
                checkRpgTrigger();
                offerHolds(anyPair);
                resetInfo = setTimeout(setReadyInfo, 3000);
            } else {
                rpgPending = false;
                setGameOver();
            }
            return;
        }

        // Check for Wizard charm multiplier (x10 all wins)
        const wizardMultiplier = (() => { try { return localStorage.getItem('emojimachine.charm.wizard') === '1' ? 10 : 1; } catch (e) { return 1; } })();

        // Wins go straight to a bonus feature — no coins awarded yet
        if (allSame && c[0] !== '💩') {
            sfx.epicWin.stop();
            sfx.epicWin.play();
            gamblePendingPair    = anyPair;
            gamblePendingAllSame = true;
            triggerWinExplosion(c[0], true);
            startWinFeature((PRIZES[c[0]] ?? PRIZES['🍒']).three * wizardMultiplier);
            return;
        }
        if (firstTwo && c[0] !== '💩') {
            sfx.win.play();
            gamblePendingPair    = anyPair;
            gamblePendingAllSame = false;
            triggerWinExplosion(c[0], false);
            startWinFeature((PRIZES[c[0]] ?? PRIZES['🍒']).two * wizardMultiplier);
            return;
        }

        // Poop / no-win — resolve immediately
        let newCoins = coins;
        if (allSame) {
            newCoins = coins - 100;
            sfx.lose.play();
            countCoins(coins, newCoins, true, 'Epic Poop! 💩');
        } else if (firstTwo) {
            newCoins = coins - 20;
            sfx.poop.play();
            countCoins(coins, newCoins, true, 'Poop! 💩');
        } else {
            infoSpan.className = 'flash-fast';
            infoSpan.innerHTML = 'No win 😭';
            if (coins >= 10) {
                sfx.lose.play();
                checkRpgTrigger();
                resetInfo = setTimeout(setReadyInfo, 3000);
            } else {
                rpgPending = false;
                setGameOver();
            }
        }

        if (newCoins >= 10) offerHolds(anyPair);
    }

    // ── Nudge result ──────────────────────────────────────────────────────────
    function onNudgeUsed() {
        nudgesRemaining--;
        const c      = [roll[0][3], roll[1][3], roll[2][3]];
        const isWin  = (c[0] === c[1] && c[1] === c[2]) || c[0] === c[1];

        if (isWin || nudgesRemaining <= 0) {
            nudgesActive    = false;
            nudgesRemaining = 0;
            updateNudgeButtons();
            processSpinResult();
        } else {
            infoSpan.className = 'flash';
            infoSpan.innerHTML = `Nudge! ${nudgesRemaining} remaining`;
            updateNudgeButtons();
        }
    }

    // ── Post-spin logic ───────────────────────────────────────────────────────
    // Offer nudges 90% of the time (never after a win), otherwise process result.
    function spinFinished() {
        const c          = [roll[0][3], roll[1][3], roll[2][3]];
        const alreadyWon = (c[0] === c[1] && c[1] === c[2]) || c[0] === c[1];
        if (!alreadyWon && Math.random() < NUDGE_PROB) {
            nudgesRemaining = (Math.random() * 4 | 0) + 2; // 2–5
            nudgesActive    = true;
            updateNudgeButtons();
            infoSpan.className = 'flash';
            infoSpan.innerHTML = `Nudge! ${nudgesRemaining} remaining`;
        } else {
            processSpinResult();
        }
    }

    // ── Spin ──────────────────────────────────────────────────────────────────
    function spin() {
        // RPG encounter counter — check on every 3rd spin
        spinCounter++;
        if (spinCounter % 3 === 0 && Math.random() * 100 < RPG_ENCOUNTER_CHANCE) {
            rpgPending = true;
        }

        const held = wheelsHeld.slice();
        wheelsHeld.fill(false);
        wheelsHoldable.fill(false);
        updateHoldButtons();

        const spinningCount = held.filter(h => !h).length;
        if (spinningCount === 0) { spinFinished(); return; }

        sfx.spinning.volume(settings.sfxVolume * 0.3);
        sfx.spinning.play();

        let stoppedCount = 0;
        const onWheelStop = () => {
            if (++stoppedCount === spinningCount) { sfx.spinning.stop(); spinFinished(); }
        };

        for (let i = 0; i < 3; i++) {
            if (held[i]) continue;
            wheelSpinning[i] = true;
            startLoop();
            const timer = setInterval(() => advanceReel(i), spinSpeeds[i]);
            const t = (Math.random() * 500 | 0) + SPIN_BASE_TIMES[i];
            setTimeout(() => {
                clearInterval(timer);
                sfx.reelStop.play();
                wheelSpinning[i] = false;
                onWheelStop();
            }, t);
        }
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    function setup() {
        syncCanvas();
        for (let i = 0; i < 3; i++) advanceReel(i);
        wheelOffsets.fill(0); // suppress entrance animation
        drawCanvas();
    }

    setup();
    // Ensure the info box reflects the (possibly loaded) coins immediately
    try { setReadyInfo(); } catch (e) { /* ignore if not available */ }

    // ── Responsive resizing ───────────────────────────────────────────────────
    function handleSizeChange() {
        const prevRow = ROW_HEIGHT || 1;
        syncCanvas();
        const scale = ROW_HEIGHT / prevRow;
        for (let i = 0; i < 3; i++) wheelOffsets[i] *= scale;
        drawCanvas();
    }

    if (window.ResizeObserver) {
        new ResizeObserver(() => handleSizeChange()).observe(canvas);
    } else {
        window.addEventListener('resize', handleSizeChange);
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleSizeChange);
        window.visualViewport.addEventListener('orientationchange', handleSizeChange);
    }

    // ── Event handlers ────────────────────────────────────────────────────────
    document.addEventListener('click', e => {
        const enterBtn = e.target.closest('#btn-enter');
        if (enterBtn) {
            const modal = document.getElementById('welcome-modal');
            modal.classList.add('welcome-modal--out');
            modal.addEventListener('animationend', () => modal.remove(), { once: true });
            // Start background music on user gesture (using saved volume)
            try {
                const b = getBgm(); if (!b.playing()) { b.volume(settings.bgmVolume); b.play(); }
            } catch (err) {
                // ignore playback errors (e.g., autoplay restrictions)
            }
            return;
        }

        const continueBtn = e.target.closest('#btn-continue');
        if (continueBtn) {
            const modal = document.getElementById('welcome-back-modal');
            if (modal) {
                modal.classList.add('welcome-back-modal--out');
                modal.addEventListener('animationend', () => modal.remove(), { once: true });
            }
            // Start background music on user gesture (using saved volume)
            try {
                const b = getBgm(); if (!b.playing()) { b.volume(settings.bgmVolume); b.play(); }
            } catch (err) {
                // ignore playback errors (e.g., autoplay restrictions)
            }
            return;
        }

        const resetGameBtn = e.target.closest('#btn-reset-game');
        if (resetGameBtn) {
            clearGameStorage();
            window.location.reload();
            return;
        }

        const timeTravelBtn = e.target.closest('#btn-time-travel');
        if (timeTravelBtn) {
            timeTravelBtn.disabled = true;
            clearGameStorage();
            sfx.rewind.play();

            // Collect all visible page elements to randomly vanish during rewind
            const vanishTargets = [
                ...document.querySelectorAll('.machine > *'),
                document.querySelector('.game-over-modal__title'),
                document.querySelector('.game-over-modal__body'),
                document.querySelector('.game-over-modal__time-prompt'),
                timeTravelBtn,
            ].filter(Boolean);

            // Shuffle (Fisher-Yates)
            for (let i = vanishTargets.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [vanishTargets[i], vanishTargets[j]] = [vanishTargets[j], vanishTargets[i]];
            }

            // Spread disappearances across the first 3.6s of the 4s SFX
            vanishTargets.forEach(el => {
                const delay = Math.random() * 3600;
                setTimeout(() => el.classList.add('time-travel-vanish'), delay);
            });

            sfx.rewind.once('end', () => window.location.reload());
            return;
        }

        const winnerRewindBtn = e.target.closest('#btn-winner-rewind');
        if (winnerRewindBtn) {
            winnerRewindBtn.disabled = true;
            clearGameStorage();
            sfx.rewind.play();

            const vanishTargets = [
                ...document.querySelectorAll('.machine > *'),
                document.querySelector('.winner-modal__title'),
                document.querySelector('.winner-modal__body'),
                document.querySelector('.winner-modal__rewind-prompt'),
                winnerRewindBtn,
            ].filter(Boolean);

            for (let i = vanishTargets.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [vanishTargets[i], vanishTargets[j]] = [vanishTargets[j], vanishTargets[i]];
            }

            vanishTargets.forEach(el => {
                const delay = Math.random() * 3600;
                setTimeout(() => el.classList.add('time-travel-vanish'), delay);
            });

            sfx.rewind.once('end', () => window.location.reload());
            return;
        }

        const nudgeUp = e.target.closest('.btn-nudge-up');
        if (nudgeUp) {
            const wheel = +nudgeUp.dataset.wheel;
            if (pbActive && pbChosen === -1 && !pbResolving) { resolvePickABox(wheel); return; }
            if (hlActive && wheel === 1) { resolveHigherLower('higher'); return; }
            if (nudgesActive && nudgesRemaining > 0) { retreatReel(wheel); sfx.reelStop.play(); onNudgeUsed(); }
            return;
        }
        const nudgeDown = e.target.closest('.btn-nudge-down');
        if (nudgeDown) {
            const wheel = +nudgeDown.dataset.wheel;
            if (hlActive && wheel === 1) { resolveHigherLower('lower'); return; }
            if (nudgesActive && nudgesRemaining > 0) { advanceReel(wheel); sfx.reelStop.play(); onNudgeUsed(); }
            return;
        }
        const holdBtn = e.target.closest('.btn-hold');
        if (holdBtn) {
            const i = +holdBtn.dataset.wheel;
            if (wheelsHoldable[i]) {
                wheelsHeld[i] = !wheelsHeld[i];
                sfx.start.play();
                updateHoldButtons();
                if (wheelsHeld[i]) {
                    if (currentHoldProb === null) currentHoldProb = BASE_HOLD_PROB.noMatch;
                    currentHoldProb = Math.max(0, Math.round((currentHoldProb - 0.10) * 100) / 100);
                }
            }
            return;
        }
        const collectBtn = e.target.closest('#btn-collect');
        if (collectBtn && collectBtn.classList.contains('ready')) {
            if (hlActive) { collectHigherLower(); }
            else if (pbActive) { collectPickABox(); }
            else if (swActive) { collectSpinTheWheel(); }
            else { collectGamble(); }
            return;
        }

        const fluffyDice = e.target.closest('.fluffy-dice');
        if (fluffyDice) {
            openLuckyDiceModal();
            return;
        }

        const trollCharm = e.target.closest('.troll-charm');
        if (trollCharm) {
            openTrollModal();
            return;
        }

        const arcadeCat = e.target.closest('.arcade-cat');
        if (arcadeCat) {
            openCatModal();
            return;
        }

        const spinBtn = e.target.closest('#btn-spin');
        if (spinBtn && spinBtn.classList.contains('ready')) {
            if (gambleActive) {
                // speed up each round and lock the current label
                gambleSpeed = Math.max(GAMBLE_MIN_SPEED, Math.round(gambleSpeed * 0.55));
                resolveGamble();
                return;
            }
            if (swActive && !swSpinning) { doSpinWheel(); return; }
            clearTimeout(resetInfo);
            nudgesActive    = false;
            nudgesRemaining = 0;
            updateNudgeButtons();
            spinBtn.classList.remove('ready');
            infoSpan.className = 'marquee';
            infoSpan.innerHTML = 'SPINNING! SPINNING! SPINNING!';
            const coins = +coinsEl.textContent;
            sfx.start.play();
            countCoins(coins, coins - 10, false);
            spin();
        }
    });
});