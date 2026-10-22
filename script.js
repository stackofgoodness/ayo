
/* Ayo Olopon — multi-round clockwise game with animated seed jars
   - Seeds are sown clockwise.
   - A hole is captured immediately when it becomes EXACTLY 4 seeds.
   - If the final seed makes an opponent's 3-seed hole become 4,
     the sowing player captures it.
   - Otherwise, the owner of the hole captures it.
   - Captured seeds fly into the capturing player's jar.
   - Captured scores and jar contents are for the current round only.
   - Remaining seeds are automatically captured when only one player
     has seeds left on their side.
   - A player who captures all 48 seeds wins the game.
   - Otherwise, the next round begins with 4 seeds in every hole.
*/

const ROW_SIZE = 6;
const TOTAL_HOLES = 12;
const START_SEEDS = 4;
const TOTAL_SEEDS = 48;
const DROP_DELAY = 340;
const PICKUP_DELAY = 750;
const CAPTURE_DELAY = 450;

const boardEl = document.getElementById("board");
const row1El = document.getElementById("row1");
const row2El = document.getElementById("row2");
const handEl = document.getElementById("hand");
const statusEl = document.getElementById("status");

const captured1El = document.getElementById("captured1");
const captured2El = document.getElementById("captured2");

const player1Card = document.getElementById("player1Card");
const player2Card = document.getElementById("player2Card");

const player1Jar = document.getElementById("player1Jar");
const player2Jar = document.getElementById("player2Jar");

const player1JarSeeds = document.getElementById("player1JarSeeds");
const player2JarSeeds = document.getElementById("player2JarSeeds");

const player1JarCount = document.getElementById("player1JarCount");
const player2JarCount = document.getElementById("player2JarCount");

const undoBtn = document.getElementById("undoBtn");
const restartBtn = document.getElementById("restartBtn");
const rulesBtn = document.getElementById("rulesBtn");
const rulesDialog = document.getElementById("rulesDialog");
const closeRulesBtn = document.getElementById("closeRulesBtn");

let state;
let history = [];
let animating = false;

// Changes whenever the game is restarted.
let gameVersion = 0;

const wait = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

const cloneState = value => JSON.parse(JSON.stringify(value));

const oppositePlayer = player => (player === 0 ? 1 : 0);


/* ---------- Initial state ---------- */

function createInitialState() {
    return {
        round: 1,
        board: Array(TOTAL_HOLES).fill(START_SEEDS),
        ownership: [
            0, 0, 0, 0, 0, 0,
            1, 1, 1, 1, 1, 1
        ],
        currentPlayer: 0,
        captured: [0, 0],
        status: "playing"
    };
}


/* ---------- Board ownership and moves ---------- */

function hasSeeds(player) {
    return state.ownership.some((owner, index) =>
        owner === player && state.board[index] > 0
    );
}

function holesOwnedBy(player) {
    return state.ownership.filter(owner => owner === player).length;
}

function legalMoves(player) {
    if (state.status !== "playing") return [];

    return state.ownership
        .map((owner, index) =>
            owner === player && state.board[index] > 0 ? index : null
        )
        .filter(index => index !== null);
}


/* ---------- Board rendering ---------- */

function createHole(clockwiseIndex) {
    const hole = document.createElement("button");

    hole.className = "hole";
    hole.type = "button";
    hole.dataset.index = clockwiseIndex;

    hole.setAttribute(
        "aria-label",
        `Hole ${clockwiseIndex + 1}`
    );

    hole.addEventListener("click", () => {
        handleHoleClick(clockwiseIndex);
    });

    return hole;
}

function buildBoard() {
    row1El.innerHTML = "";
    row2El.innerHTML = "";

    // Bottom row: clockwise indexes 0 to 5.
    for (let index = 0; index < ROW_SIZE; index++) {
        row1El.appendChild(createHole(index));
    }

    // Top row: clockwise indexes 11 to 6.
    for (let index = TOTAL_HOLES - 1; index >= ROW_SIZE; index--) {
        row2El.appendChild(createHole(index));
    }
}

function holeElement(clockwiseIndex) {
    return boardEl.querySelector(
        `.hole[data-index="${clockwiseIndex}"]`
    );
}

function renderHoleSeeds(index) {
    const hole = holeElement(index);

    if (!hole) return;

    const count = state.board[index];
    const owner = state.ownership[index];

    hole.querySelectorAll(".seed").forEach(seed => seed.remove());

    hole.classList.toggle("player1-hole", owner === 0);
    hole.classList.toggle("player2-hole", owner === 1);

    const visibleSeeds = Math.min(count, 16);

    for (let seedIndex = 0; seedIndex < visibleSeeds; seedIndex++) {
        const seed = document.createElement("span");
        seed.className = "seed";

        const angle =
            (seedIndex / Math.max(visibleSeeds, 1)) * Math.PI * 2;

        const radius = visibleSeeds <= 4 ? 22 : 30;

        seed.style.left = `calc(50% + ${Math.cos(angle) * radius
            }% - 6.5px)`;

        seed.style.top = `calc(50% + ${Math.sin(angle) * radius
            }% - 6.5px)`;

        hole.appendChild(seed);
    }
}

function renderAllSeeds() {
    for (let index = 0; index < TOTAL_HOLES; index++) {
        renderHoleSeeds(index);
    }
}


/* ---------- Seed jar rendering ---------- */

function renderJar(player) {
    const seedsContainer =
        player === 0 ? player1JarSeeds : player2JarSeeds;

    const countElement =
        player === 0 ? player1JarCount : player2JarCount;

    if (!seedsContainer || !countElement) return;

    const count = state.captured[player];

    countElement.textContent = count;
    seedsContainer.innerHTML = "";

    // Show up to 48 individual seeds in the jar.
    for (let i = 0; i < Math.min(count, TOTAL_SEEDS); i++) {
        const seed = document.createElement("span");
        seed.className = "jar-seed";

        seedsContainer.appendChild(seed);
    }
}

function renderAllJars() {
    renderJar(0);
    renderJar(1);
}


/* ---------- Controls and rendering ---------- */

function renderControls() {
    const holes = boardEl.querySelectorAll(".hole");

    holes.forEach(hole => {
        const index = Number(hole.dataset.index);

        hole.classList.remove("legal", "last", "pickup", "captured");

        const isLegal =
            !animating &&
            state.status === "playing" &&
            state.ownership[index] === state.currentPlayer &&
            state.board[index] > 0;

        hole.disabled = !isLegal;

        if (isLegal) {
            hole.classList.add("legal");
        }
    });

    captured1El.textContent = state.captured[0];
    captured2El.textContent = state.captured[1];

    player1Card.classList.toggle(
        "active",
        state.status === "playing" && state.currentPlayer === 0
    );

    player2Card.classList.toggle(
        "active",
        state.status === "playing" && state.currentPlayer === 1
    );

    if (state.status === "finished") {
        statusEl.textContent = getWinner();
    } else {
        statusEl.textContent =
            `Round ${state.round} — Player ${state.currentPlayer + 1}’s turn`;
    }

    undoBtn.disabled = history.length === 0 || animating;
}

function render() {
    renderAllSeeds();
    renderAllJars();
    renderControls();
}


/* ---------- Animation helpers ---------- */

// Position of a hole relative to the board.
function centerOf(hole) {
    const boardRect = boardEl.getBoundingClientRect();
    const holeRect = hole.getBoundingClientRect();

    return {
        left: holeRect.left - boardRect.left + holeRect.width / 2,
        top: holeRect.top - boardRect.top + holeRect.height / 2
    };
}

function moveHandTo(hole, press = false) {
    if (!hole) return;

    const point = centerOf(hole);

    handEl.style.left = `${point.left}px`;
    handEl.style.top = `${point.top}px`;
    handEl.classList.add("show");

    if (press) {
        handEl.classList.remove("press");
        void handEl.offsetWidth;
        handEl.classList.add("press");
    }
}

function hideHand() {
    handEl.classList.remove("show");
}

function createFlyingSeed(fromHole) {
    const seed = document.createElement("div");
    seed.className = "flying-seed";

    const point = centerOf(fromHole);

    seed.style.left = `${point.left - 7.5}px`;
    seed.style.top = `${point.top - 7.5}px`;

    boardEl.appendChild(seed);

    return seed;
}

function flySeedTo(seed, targetHole) {
    const point = centerOf(targetHole);

    seed.style.left = `${point.left - 7.5}px`;
    seed.style.top = `${point.top - 7.5}px`;
}

async function animateSeedDrop(fromIndex, toIndex, version) {
    const fromHole = holeElement(fromIndex);
    const toHole = holeElement(toIndex);

    if (!fromHole || !toHole || version !== gameVersion) {
        return false;
    }

    const flyingSeed = createFlyingSeed(fromHole);
    moveHandTo(toHole);

    await wait(20);

    if (version !== gameVersion) {
        flyingSeed.remove();
        return false;
    }

    flySeedTo(flyingSeed, toHole);

    await wait(DROP_DELAY);

    if (version !== gameVersion) {
        flyingSeed.remove();
        return false;
    }

    state.board[toIndex]++;
    renderHoleSeeds(toIndex);
    flyingSeed.remove();

    return true;
}

async function animatePickup(index, version) {
    const hole = holeElement(index);

    if (!hole || version !== gameVersion) {
        return false;
    }

    moveHandTo(hole, true);
    hole.classList.add("pickup");

    await wait(PICKUP_DELAY);

    if (version !== gameVersion) {
        hole.classList.remove("pickup");
        return false;
    }

    state.board[index] = 0;
    renderHoleSeeds(index);
    hole.classList.remove("pickup");

    return true;
}


/* ---------- Animate seeds entering a jar ---------- */

async function animateSeedsIntoJar(holeIndex, player, count, version) {
    const sourceHole = holeElement(holeIndex);
    const targetJar = player === 0 ? player1Jar : player2Jar;

    if (
        !sourceHole ||
        !targetJar ||
        count <= 0 ||
        version !== gameVersion
    ) {
        return false;
    }

    const jarVisual = targetJar.querySelector(".jar-visual");

    if (!jarVisual) return false;

    const sourceRect = sourceHole.getBoundingClientRect();
    const targetRect = jarVisual.getBoundingClientRect();

    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;

    const flyingSeeds = [];

    for (let i = 0; i < count; i++) {
        const seed = document.createElement("div");

        seed.className =
            "jar-flying-seed " +
            (player === 0 ? "player1-seed" : "player2-seed");

        const angle = (i / Math.max(count, 1)) * Math.PI * 2;
        const spread = Math.min(12, count);

        seed.style.left =
            `${sourceX + Math.cos(angle) * spread}px`;

        seed.style.top =
            `${sourceY + Math.sin(angle) * spread}px`;

        seed.style.transform = "translate(-50%, -50%)";

        document.body.appendChild(seed);
        flyingSeeds.push(seed);
    }

    await wait(30);

    if (version !== gameVersion) {
        flyingSeeds.forEach(seed => seed.remove());
        return false;
    }

    flyingSeeds.forEach((seed, i) => {
        seed.style.transitionDelay = `${Math.min(i, 15) * 12}ms`;
        seed.style.left = `${targetX}px`;
        seed.style.top = `${targetY}px`;
    });

    await wait(CAPTURE_DELAY + Math.min(count, 16) * 12);

    flyingSeeds.forEach(seed => seed.remove());

    return version === gameVersion;
}


/* ---------- Capturing seeds ---------- */

async function animateCapture(index, owner, version) {
    if (version !== gameVersion) return false;

    const hole = holeElement(index);
    const capturedSeeds = state.board[index];

    if (!hole || capturedSeeds <= 0) return true;

    moveHandTo(hole, true);
    hole.classList.add("captured");

    const completed = await animateSeedsIntoJar(
        index,
        owner,
        capturedSeeds,
        version
    );

    if (!completed || version !== gameVersion) {
        hole.classList.remove("captured");
        return false;
    }

    state.captured[owner] += capturedSeeds;
    renderJar(owner);

    state.board[index] = 0;
    renderHoleSeeds(index);

    hole.classList.remove("captured");

    return true;
}


/* ---------- Round and game flow ---------- */

function getWinner() {
    if (state.captured[0] > state.captured[1]) {
        return "Player 1 wins the game!";
    }

    if (state.captured[1] > state.captured[0]) {
        return "Player 2 wins the game!";
    }

    return "It’s a draw!";
}

function gameIsOver() {
    return (
        state.captured[0] === TOTAL_SEEDS ||
        state.captured[1] === TOTAL_SEEDS
    );
}


/*
  Allocate all 12 holes proportionally.

  When a score is not divisible by 4, use the largest-remainder
  method to decide who receives the final hole.
*/
function calculateNextOwnership() {
    const player1Seeds = state.captured[0];
    const player2Seeds = state.captured[1];

    if (player1Seeds + player2Seeds !== TOTAL_SEEDS) {
        throw new Error(
            "Round scores must total exactly 48 seeds before allocating holes."
        );
    }

    const player1Exact = (player1Seeds / TOTAL_SEEDS) * TOTAL_HOLES;
    const player2Exact = (player2Seeds / TOTAL_SEEDS) * TOTAL_HOLES;

    let player1Holes = Math.floor(player1Exact);
    let player2Holes = Math.floor(player2Exact);

    const unallocated =
        TOTAL_HOLES - player1Holes - player2Holes;

    if (unallocated > 0) {
        const player1Remainder = player1Exact - player1Holes;
        const player2Remainder = player2Exact - player2Holes;

        if (player1Remainder >= player2Remainder) {
            player1Holes += unallocated;
        } else {
            player2Holes += unallocated;
        }
    }

    const ownership = [
        ...Array(player1Holes).fill(0),
        ...Array(player2Holes).fill(1)
    ];

    return {
        ownership,
        player1Holes,
        player2Holes
    };
}


/* ---------- Round result dialog ---------- */

function showRoundResult(player1Holes, player2Holes) {
    const existingDialog = document.getElementById("roundResultDialog");

    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement("dialog");
    dialog.id = "roundResultDialog";

    const difference = state.captured[0] - state.captured[1];

    let resultMessage;

    if (difference > 0) {
        resultMessage =
            `Player 1 won the round by ${difference} seed(s).`;
    } else if (difference < 0) {
        resultMessage =
            `Player 2 won the round by ${Math.abs(difference)} seed(s).`;
    } else {
        resultMessage = "The round ended in a tie.";
    }

    dialog.innerHTML = `
    <h2>Round ${state.round} complete</h2>
    <p>${resultMessage}</p>
    <p>
      Player 1 captured: ${state.captured[0]} seeds<br>
      Player 2 captured: ${state.captured[1]} seeds
    </p>
    <p>
      Next round holes:<br>
      Player 1: ${player1Holes}<br>
      Player 2: ${player2Holes}
    </p>
    <p>
      The next round will begin with ${START_SEEDS} seeds in every hole.
    </p>
    <button id="startNextRoundBtn" type="button">
      Start Round ${state.round + 1}
    </button>
  `;

    document.body.appendChild(dialog);

    dialog.querySelector("#startNextRoundBtn").addEventListener("click", () => {
        dialog.close();
        dialog.remove();
        startNextRound();
    });

    dialog.addEventListener("cancel", event => {
        event.preventDefault();
    });

    dialog.showModal();
}


/* ---------- Start the next round ---------- */

function startNextRound() {
    // Determine the next ownership before resetting the current score.
    const result = calculateNextOwnership();

    // The winner of the previous round starts next.
    // Player 1 starts if the round was tied.
    let nextStartingPlayer = 0;

    if (state.captured[1] > state.captured[0]) {
        nextStartingPlayer = 1;
    }

    state.round++;
    state.board = Array(TOTAL_HOLES).fill(START_SEEDS);
    state.ownership = result.ownership;
    state.currentPlayer = nextStartingPlayer;
    state.captured = [0, 0];
    state.status = "playing";

    // Clear the previous round's undo history.
    history = [];

    // Enable the board for the new round.
    animating = false;

    hideHand();
    render();
}


/* ---------- End the current round ---------- */

async function endRound(version) {
    if (version !== gameVersion || state.status !== "playing") return;

    const player1HasSeeds = hasSeeds(0);
    const player2HasSeeds = hasSeeds(1);

    let capturingPlayer;

    if (player1HasSeeds && !player2HasSeeds) {
        capturingPlayer = 0;
    } else if (player2HasSeeds && !player1HasSeeds) {
        capturingPlayer = 1;
    } else {
        capturingPlayer = oppositePlayer(state.currentPlayer);
    }

    // Animate the remaining seeds into the capturing player's jar.
    for (let index = 0; index < TOTAL_HOLES; index++) {
        const remainingInHole = state.board[index];

        if (remainingInHole > 0) {
            const completed = await animateSeedsIntoJar(
                index,
                capturingPlayer,
                remainingInHole,
                version
            );

            // Stop if the animation was interrupted by a restart.
            if (!completed || version !== gameVersion) return;
        }
    }

    // Make sure this round has not been interrupted.
    if (version !== gameVersion) return;

    // Count all remaining seeds after the animations finish.
    const remainingSeeds = state.board.reduce(
        (total, count) => total + count,
        0
    );

    state.captured[capturingPlayer] += remainingSeeds;

    // Clear all holes.
    state.board = Array(TOTAL_HOLES).fill(0);

    renderAllSeeds();
    renderAllJars();

    captured1El.textContent = state.captured[0];
    captured2El.textContent = state.captured[1];

    // End the game only if one player captured all 48 seeds.
    if (gameIsOver()) {
        state.status = "finished";
        animating = false;
        hideHand();
        render();
        return;
    }

    // Calculate the hole allocation for the next round.
    const result = calculateNextOwnership();

    hideHand();
    render();

    showRoundResult(
        result.player1Holes,
        result.player2Holes
    );
}


/* ---------- Player interaction ---------- */

async function handleHoleClick(clockwiseIndex) {
    if (animating || state.status !== "playing") return;

    const version = gameVersion;
    const player = state.currentPlayer;

    if (state.ownership[clockwiseIndex] !== player) return;
    if (state.board[clockwiseIndex] === 0) return;

    // Save the current state for undo.
    history.push(cloneState(state));

    const selectedHole = holeElement(clockwiseIndex);

    animating = true;
    renderControls();

    // Pick up all seeds from the selected hole.
    let seeds = state.board[clockwiseIndex];

    state.board[clockwiseIndex] = 0;
    renderHoleSeeds(clockwiseIndex);

    moveHandTo(selectedHole, true);

    await wait(450);

    if (version !== gameVersion) return;

    let fromIndex = clockwiseIndex;
    let currentIndex = clockwiseIndex;

    while (seeds > 0) {
        currentIndex = (currentIndex + 1) % TOTAL_HOLES;

        const dropped = await animateSeedDrop(
            fromIndex,
            currentIndex,
            version
        );

        if (!dropped || version !== gameVersion) return;

        fromIndex = currentIndex;
        seeds--;

        /*
          Capture whenever a hole becomes exactly 4 seeds.
          If the final seed makes an opponent's 3-seed hole become 4,
          the sowing player captures it. Otherwise, the hole's owner
          captures it.
        */
        if (state.board[currentIndex] === 4) {
            const isFinalSeed = seeds === 0;

            const isOpponentHole =
                state.ownership[currentIndex] === oppositePlayer(player);

            const capturingPlayer =
                isFinalSeed && isOpponentHole
                    ? player
                    : state.ownership[currentIndex];

            const captured = await animateCapture(
                currentIndex,
                capturingPlayer,
                version
            );

            if (!captured || version !== gameVersion) return;

            // Continue sowing any seeds still held.
            continue;
        }

        /*
          Relay: if the final seed lands in a hole that now contains
          more than one seed, pick them all up and continue sowing.
        */
        if (seeds === 0 && state.board[currentIndex] > 1) {
            const relayHole = holeElement(currentIndex);

            relayHole.classList.add("last");

            await wait(350);

            if (version !== gameVersion) return;

            seeds = state.board[currentIndex];

            const pickedUp = await animatePickup(currentIndex, version);

            if (!pickedUp || version !== gameVersion) return;

            fromIndex = currentIndex;
        }
    }

    const finalHole = holeElement(currentIndex);

    if (finalHole) {
        finalHole.classList.add("last");
        moveHandTo(finalHole, true);

        await wait(500);

        if (version !== gameVersion) return;
    }

    // If the current player has no seeds, finish the round.
    if (!hasSeeds(player)) {
        state.currentPlayer = oppositePlayer(player);
        hideHand();

        // Keep the board disabled while the remaining seeds are collected.
        await endRound(version);
        return;
    }

    // End the move and allow the other player to play.
    state.currentPlayer = oppositePlayer(player);
    animating = false;

    hideHand();
    render();
}


/* ---------- Undo and restart ---------- */

function undo() {
    if (history.length === 0 || animating) return;

    state = history.pop();

    hideHand();
    render();
}

function restart() {
    // Invalidate any old moves and animations.
    gameVersion++;

    const resultDialog = document.getElementById("roundResultDialog");

    if (resultDialog) {
        if (resultDialog.open) {
            resultDialog.close();
        }

        resultDialog.remove();
    }

    // Remove any seeds still flying during an animation.
    document.querySelectorAll(
        ".flying-seed, .jar-flying-seed"
    ).forEach(seed => seed.remove());

    state = createInitialState();
    history = [];
    animating = false;

    hideHand();
    handEl.classList.remove("press");

    boardEl.querySelectorAll(".hole").forEach(hole => {
        hole.classList.remove("last", "pickup", "captured");
    });

    render();
}


/* ---------- Initialize ---------- */

buildBoard();
restart();

undoBtn.addEventListener("click", undo);
restartBtn.addEventListener("click", restart);

rulesBtn.addEventListener("click", () => {
    rulesDialog.showModal();
});

closeRulesBtn.addEventListener("click", () => {
    rulesDialog.close();
});
