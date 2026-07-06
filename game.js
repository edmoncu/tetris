const COLS = 10;
const ROWS = 20;
const CELL = 30;
const EMPTY = 0;

const COLORS = {
  I: "#3fd1c5",
  J: "#5688f0",
  L: "#e89b3c",
  O: "#f0ce4a",
  S: "#69c95f",
  T: "#ad79ed",
  Z: "#e75f65",
  ghost: "rgba(246, 244, 236, 0.24)"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};

const boardCanvas = document.querySelector("#board");
const boardCtx = boardCanvas.getContext("2d");
const nextCtx = document.querySelector("#next").getContext("2d");
const holdCtx = document.querySelector("#hold").getContext("2d");
const scoreEl = document.querySelector("#score");
const linesEl = document.querySelector("#lines");
const levelEl = document.querySelector("#level");
const message = document.querySelector("#message");
const messageTitle = message.querySelector("h2");
const messageText = message.querySelector("p");
const startButton = document.querySelector("#start");
const pauseButton = document.querySelector("#pause");
const restartButton = document.querySelector("#restart");

let board;
let bag;
let queue;
let current;
let holdPiece;
let canHold;
let score;
let lines;
let level;
let dropCounter;
let lastTime;
let running;
let paused;
let gameOver;

function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  bag = [];
  queue = [];
  holdPiece = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  lastTime = 0;
  running = false;
  paused = false;
  gameOver = false;
  while (queue.length < 5) queue.push(nextType());
  current = createPiece(queue.shift());
  queue.push(nextType());
  updateHud();
  draw();
  showMessage("Ready", "Clear rows and keep the stack low.", "Start Game");
}

function startGame() {
  if (gameOver) resetGame();
  running = true;
  paused = false;
  hideMessage();
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function update(time = 0) {
  if (!running || paused || gameOver) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropDelay()) {
    softDrop(false);
  }
  draw();
  requestAnimationFrame(update);
}

function dropDelay() {
  return Math.max(90, 760 - (level - 1) * 62);
}

function nextType() {
  if (bag.length === 0) {
    bag = Object.keys(SHAPES).sort(() => Math.random() - 0.5);
  }
  return bag.pop();
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0
  };
}

function spawnPiece() {
  current = createPiece(queue.shift());
  queue.push(nextType());
  canHold = true;
  if (collides(current.matrix, current.x, current.y)) {
    gameOver = true;
    running = false;
    showMessage("Game Over", `Final score: ${score}`, "Play Again");
  }
}

function move(dir) {
  if (!canAct()) return;
  if (!collides(current.matrix, current.x + dir, current.y)) {
    current.x += dir;
    draw();
  }
}

function softDrop(addScore = true) {
  if (!canAct()) return;
  if (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    if (addScore) score += 1;
  } else {
    lockPiece();
  }
  dropCounter = 0;
  updateHud();
  draw();
}

function hardDrop() {
  if (!canAct()) return;
  let cells = 0;
  while (!collides(current.matrix, current.x, current.y + 1)) {
    current.y += 1;
    cells += 1;
  }
  score += cells * 2;
  lockPiece();
  updateHud();
  draw();
}

function rotatePiece() {
  if (!canAct()) return;
  const rotated = rotate(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collides(rotated, current.x + kick, current.y)) {
      current.matrix = rotated;
      current.x += kick;
      draw();
      return;
    }
  }
}

function holdCurrent() {
  if (!canAct() || !canHold) return;
  const heldType = holdPiece;
  holdPiece = current.type;
  if (heldType) {
    current = createPiece(heldType);
  } else {
    spawnPiece();
  }
  canHold = false;
  draw();
}

function lockPiece() {
  current.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) board[current.y + y][current.x + x] = current.type;
    });
  });
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      y += 1;
    }
  }
  if (!cleared) return;
  const values = [0, 100, 300, 500, 800];
  score += values[cleared] * level;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  updateHud();
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides(matrix, offsetX, offsetY) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardX = offsetX + x;
      const boardY = offsetY + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function ghostY() {
  let y = current.y;
  while (!collides(current.matrix, current.x, y + 1)) y += 1;
  return y;
}

function draw() {
  drawBoard();
  drawMatrix(current.matrix, current.x, ghostY(), COLORS.ghost, boardCtx);
  drawMatrix(current.matrix, current.x, current.y, COLORS[current.type], boardCtx);
  drawPreview(nextCtx, queue[0]);
  drawPreview(holdCtx, holdPiece);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  const bg = boardCtx.createLinearGradient(0, 0, boardCanvas.width, boardCanvas.height);
  bg.addColorStop(0, "#0c1110");
  bg.addColorStop(1, "#17201d");
  boardCtx.fillStyle = bg;
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.strokeStyle = "rgba(246, 244, 236, 0.07)";
  boardCtx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL, 0);
    boardCtx.lineTo(x * CELL, ROWS * CELL);
    boardCtx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL);
    boardCtx.lineTo(COLS * CELL, y * CELL);
    boardCtx.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawCell(boardCtx, x, y, COLORS[type]);
    });
  });
}

function drawMatrix(matrix, offsetX, offsetY, color, context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawCell(context, offsetX + x, offsetY + y, color);
    });
  });
}

function drawCell(context, x, y, color) {
  const px = x * CELL;
  const py = y * CELL;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fillRect(px + 4, py + 4, CELL - 8, 5);
  context.strokeStyle = "rgba(0, 0, 0, 0.26)";
  context.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
}

function drawPreview(context, type) {
  context.clearRect(0, 0, 112, 112);
  context.fillStyle = "#121715";
  context.fillRect(0, 0, 112, 112);
  if (!type) return;
  const matrix = SHAPES[type];
  const block = 22;
  const width = matrix[0].length * block;
  const height = matrix.length * block;
  const startX = (112 - width) / 2;
  const startY = (112 - height) / 2;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      context.fillStyle = COLORS[type];
      context.fillRect(startX + x * block + 1, startY + y * block + 1, block - 2, block - 2);
      context.fillStyle = "rgba(255, 255, 255, 0.14)";
      context.fillRect(startX + x * block + 4, startY + y * block + 4, block - 8, 4);
    });
  });
}

function updateHud() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function showMessage(title, text, buttonText) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  startButton.textContent = buttonText;
  message.classList.remove("hidden");
}

function hideMessage() {
  message.classList.add("hidden");
}

function togglePause() {
  if (gameOver || !running) return;
  paused = !paused;
  pauseButton.textContent = paused ? "Resume" : "Pause";
  if (paused) {
    showMessage("Paused", "Take a breath. The stack can wait.", "Resume");
  } else {
    hideMessage();
    lastTime = performance.now();
    requestAnimationFrame(update);
  }
}

function canAct() {
  return running && !paused && !gameOver;
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "a", "d", "w", "s", "c", "p"].includes(key)) {
    event.preventDefault();
  }
  if (key === "arrowleft" || key === "a") move(-1);
  if (key === "arrowright" || key === "d") move(1);
  if (key === "arrowup" || key === "w") rotatePiece();
  if (key === "arrowdown" || key === "s") softDrop();
  if (key === " ") hardDrop();
  if (key === "c") holdCurrent();
  if (key === "p") togglePause();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "rotate") rotatePiece();
    if (action === "down") softDrop();
    if (action === "drop") hardDrop();
    if (action === "hold") holdCurrent();
  });
});

startButton.addEventListener("click", () => {
  if (paused) togglePause();
  else startGame();
});
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  resetGame();
  startGame();
});

resetGame();
