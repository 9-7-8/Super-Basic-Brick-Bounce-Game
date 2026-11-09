// ============================================================
// juice.js: the "juiced up" version of Block Breaker
//
// Press J to add the next juice layer. Press X to go back to the
// plain game.
//
// IMPORTANT: none of this changes the rules. The ball's speed,
// the bounce angles, and the collisions are exactly the same.
// juice.js only WATCHES the game (it notices when the ball hits
// something) and then draws extra things on top. That is what
// "juice" means: the game FEELS better, but it plays the same.
// ============================================================

const JUICE_LAYERS = [
  "Flash",        // 1: the paddle (and a hit brick) flash yellow
  "Squash",       // 2: the paddle and ball squash and pop back
  "Sparks",       // 3: a burst of sparks where the ball hits
  "Pop text",     // 4: "PONG!" and "POW!" float up and fade
  "Screen shake", // 5: the screen shakes a little on brick hits
  "Brick wobble", // 6: a hit brick jumps and wobbles
  "Ball trail",   // 7: the ball leaves a fading trail
  "Level wiggle", // 8: the whole wall of bricks waves on paddle hits
  "Sound"         // 9: little blip sounds
];

let juiceLevel = 0;
let juiceLabelTime = 0;   // when the level last changed (for the label pop)

function juiceOn(layerNumber) {
  return juiceLevel >= layerNumber;
}

function now() {
  return performance.now() / 1000;  // seconds
}


// ------------------------------------------------------------
// EFFECT STATE (only used for drawing)
// ------------------------------------------------------------
let paddleHitTime = -10;
let ballBounceTime = -10;
let shakeTime = -10;
let wiggleTime = -10;
const brickHitTimes = new Map();  // brick -> time it was hit
let particles = [];
let popTexts = [];
let trail = [];

function clearJuice() {
  paddleHitTime = -10;
  ballBounceTime = -10;
  shakeTime = -10;
  wiggleTime = -10;
  brickHitTimes.clear();
  particles = [];
  popTexts = [];
  trail = [];
}


// ------------------------------------------------------------
// WATCHING THE GAME
// We wrap the three bounce functions from collisions.js. Each
// wrapper calls the ORIGINAL function first, unchanged, and then
// only looks at what happened.
// ------------------------------------------------------------
const plainBounceOffWalls = bounceOffWalls;
const plainBounceOffPaddle = bounceOffPaddle;
const plainBounceOffBricks = bounceOffBricks;

bounceOffWalls = function () {
  const vx = ball.vx;
  const vy = ball.vy;
  plainBounceOffWalls();
  if (ball.vx !== vx || ball.vy !== vy) {
    onWallHit();
  }
};

bounceOffPaddle = function () {
  const vy = ball.vy;
  plainBounceOffPaddle();
  if (ball.vy !== vy) {
    onPaddleHit();
  }
};

bounceOffBricks = function () {
  // The original bounces off the FIRST brick it touches, so we
  // look for that same brick before it runs.
  let hitBrick = null;
  for (const brick of bricks) {
    if (boxesTouch(ball, brick)) {
      hitBrick = brick;
      break;
    }
  }
  plainBounceOffBricks();
  if (hitBrick) {
    onBrickHit(hitBrick);
  }
};


// ------------------------------------------------------------
// WHAT EACH HIT TRIGGERS
// ------------------------------------------------------------
function ballCenterX() { return ball.x + ball.width / 2; }
function ballCenterY() { return ball.y + ball.height / 2; }

function onPaddleHit() {
  paddleHitTime = now();
  ballBounceTime = now();
  wiggleTime = now();
  if (juiceOn(3)) makeSparks(ballCenterX(), paddle.y, 14, "#ffe14d");
  if (juiceOn(4)) makePopText("PONG!", ballCenterX(), paddle.y - 10, "#ffe14d");
  if (juiceOn(9)) blip(440, 0.08, "square");
}

function onBrickHit(brick) {
  brickHitTimes.set(brick, now());
  ballBounceTime = now();
  shakeTime = now();
  if (juiceOn(3)) makeSparks(ballCenterX(), ballCenterY(), 18, "#ff8a3d");
  if (juiceOn(4)) {
    const words = ["POW!", "BONK!", "WHAM!", "+1"];
    const word = words[Math.floor(Math.random() * words.length)];
    makePopText(word, brick.x + brick.width / 2, brick.y, "#ff8a3d");
  }
  if (juiceOn(9)) blip(660 + Math.random() * 200, 0.1, "triangle");
}

function onWallHit() {
  ballBounceTime = now();
  if (juiceOn(3)) makeSparks(ballCenterX(), ballCenterY(), 6, "#9fd8ff");
  if (juiceOn(9)) blip(220, 0.05, "sine");
}


// ------------------------------------------------------------
// SPARKS AND POP TEXT
// ------------------------------------------------------------
function makeSparks(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 180;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      born: now(),
      life: 0.4 + Math.random() * 0.4,
      size: 2 + Math.random() * 3,
      color: color
    });
  }
}

function makePopText(text, x, y, color) {
  popTexts.push({ text: text, x: x, y: y, born: now(), color: color });
}


// ------------------------------------------------------------
// SOUND (layer 9 only)
// ------------------------------------------------------------
let audio = null;

function blip(frequency, length, wave) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = wave;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.15, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + length);
}


// ------------------------------------------------------------
// THE J AND X KEYS
// ------------------------------------------------------------
document.addEventListener("keydown", function (event) {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  if (key === "j" && juiceLevel < JUICE_LAYERS.length) {
    juiceLevel = juiceLevel + 1;
    juiceLabelTime = now();
    if (juiceOn(9) && !audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audio = new AudioCtx();
    }
  }
  if (key === "x") {
    juiceLevel = 0;
    clearJuice();
  }
});


// ------------------------------------------------------------
// DRAWING
// We wrap draw() from game.js. While the original draw() runs,
// we catch each rectangle it paints (background, paddle, ball,
// bricks) and paint a juicier version instead. The real paddle,
// ball and bricks are never moved.
// ------------------------------------------------------------
const plainDraw = draw;
const plainFillRect = ctx.fillRect.bind(ctx);

draw = function () {
  if (juiceLevel === 0) {
    plainDraw();
    return;
  }

  const t = now();

  // Remember where the ball has been (layer 7).
  trail.push({ x: ball.x, y: ball.y });
  if (trail.length > 12) trail.shift();

  ctx.save();

  // Layer 5: screen shake.
  if (juiceOn(5)) {
    const age = t - shakeTime;
    if (age < 0.2) {
      const strength = 5 * (1 - age / 0.2);
      ctx.translate((Math.random() * 2 - 1) * strength, (Math.random() * 2 - 1) * strength);
    }
  }

  ctx.fillRect = juicyFillRect;
  try {
    plainDraw();
  } finally {
    ctx.fillRect = plainFillRect;
  }

  drawParticles(t);
  drawPopTexts(t);
  ctx.restore();

  drawJuiceLabel(t);
};

// A bouncy "boing" curve: starts at 1, wobbles, settles at 0.
function boing(age, length) {
  if (age < 0 || age > length) return 0;
  return Math.exp(-age * 10) * Math.cos(age * 35);
}

function juicyFillRect(x, y, w, h) {
  const t = now();

  // The background (painted bigger so shaking never shows a gap).
  if (x === 0 && y === 0 && w === WIDTH && h === HEIGHT) {
    let shade = "black";
    // Layer 8: the whole screen blinks once on a paddle hit.
    if (juiceOn(8) && t - wiggleTime < 0.08) shade = "#1c1c2e";
    ctx.fillStyle = shade;
    plainFillRect(-20, -20, WIDTH + 40, HEIGHT + 40);
    ctx.fillStyle = "white";
    return;
  }

  // The paddle.
  if (x === paddle.x && y === paddle.y && w === paddle.width && h === paddle.height) {
    drawJuicyPaddle(t);
    return;
  }

  // The ball.
  if (x === ball.x && y === ball.y && w === ball.width && h === ball.height) {
    drawJuicyBall(t);
    return;
  }

  // A brick.
  const brick = bricks.find(function (b) {
    return b.x === x && b.y === y && b.width === w && b.height === h;
  });
  if (brick) {
    drawJuicyBrick(brick, t);
    return;
  }

  plainFillRect(x, y, w, h);
}

function drawJuicyPaddle(t) {
  const age = t - paddleHitTime;
  let w = paddle.width;
  let h = paddle.height;

  // Layer 2: squash flat and wide, then pop back.
  if (juiceOn(2)) {
    const s = boing(age, 0.5);
    w = paddle.width * (1 + 0.3 * s);
    h = paddle.height * (1 - 0.5 * s);
  }

  const x = paddle.x + (paddle.width - w) / 2;
  const y = paddle.y + (paddle.height - h);   // stays on the floor

  // Layer 1: flash bright yellow for a quarter second.
  ctx.fillStyle = (juiceOn(1) && age < 0.25) ? "#ffe14d" : "white";
  plainFillRect(x, y, w, h);
  ctx.fillStyle = "white";
}

function drawJuicyBall(t) {
  // Layer 7: a fading trail behind the ball.
  if (juiceOn(7)) {
    for (let i = 0; i < trail.length - 1; i++) {
      const p = trail[i];
      const fade = (i + 1) / trail.length;
      ctx.globalAlpha = fade * 0.5;
      ctx.fillStyle = "#9fd8ff";
      const shrink = (1 - fade) * ball.width * 0.4;
      plainFillRect(p.x + shrink, p.y + shrink, ball.width - shrink * 2, ball.height - shrink * 2);
    }
    ctx.globalAlpha = 1;
  }

  let w = ball.width;
  let h = ball.height;

  // Layer 2: the ball squashes too when it bounces.
  if (juiceOn(2)) {
    const s = boing(t - ballBounceTime, 0.3);
    w = ball.width * (1 + 0.35 * s);
    h = ball.height * (1 - 0.35 * s);
  }

  ctx.fillStyle = "white";
  plainFillRect(ball.x + (ball.width - w) / 2, ball.y + (ball.height - h) / 2, w, h);
}

function drawJuicyBrick(brick, t) {
  const hitTime = brickHitTimes.has(brick) ? brickHitTimes.get(brick) : -10;
  const age = t - hitTime;
  let x = brick.x;
  let y = brick.y;
  let w = brick.width;
  let h = brick.height;

  // Layer 6: the hit brick jumps up and wobbles.
  if (juiceOn(6)) {
    const s = boing(age, 0.5);
    y = y - 6 * s;
    w = brick.width * (1 + 0.15 * s);
    h = brick.height * (1 + 0.15 * s);
    x = brick.x - (w - brick.width) / 2;
  }

  // Layer 8: the whole wall of bricks waves after a paddle hit.
  if (juiceOn(8)) {
    const wiggleAge = t - wiggleTime;
    if (wiggleAge < 0.6) {
      const delay = (brick.x / WIDTH) * 0.25;
      const s = boing(wiggleAge - delay, 0.6 - delay);
      y = y + 4 * s;
    }
  }

  // Layer 1: a hit brick flashes yellow too.
  ctx.fillStyle = (juiceOn(1) && age < 0.15) ? "#ffe14d" : "white";
  plainFillRect(x, y, w, h);
  ctx.fillStyle = "white";
}

function drawParticles(t) {
  const alive = [];
  for (const p of particles) {
    const age = t - p.born;
    if (age > p.life) continue;
    alive.push(p);
    const px = p.x + p.vx * age;
    const py = p.y + p.vy * age + 300 * age * age;  // gravity pulls sparks down
    ctx.globalAlpha = 1 - age / p.life;
    ctx.fillStyle = p.color;
    plainFillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  particles = alive;
}

function drawPopTexts(t) {
  const alive = [];
  ctx.textAlign = "center";
  for (const p of popTexts) {
    const age = t - p.born;
    if (age > 0.8) continue;
    alive.push(p);
    const grow = age < 0.1 ? age / 0.1 : 1;
    ctx.globalAlpha = 1 - age / 0.8;
    ctx.fillStyle = p.color;
    ctx.font = "bold " + Math.round(18 * grow + 4) + "px 'Courier New', monospace";
    ctx.fillText(p.text, p.x, p.y - age * 50);
  }
  ctx.globalAlpha = 1;
  popTexts = alive;
}

// The label in the corner: "JUICE 3: Sparks". Hidden at level 0.
function drawJuiceLabel(t) {
  const age = t - juiceLabelTime;
  const pop = age < 0.3 ? 1 + 0.5 * (1 - age / 0.3) : 1;
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "bold " + Math.round(16 * pop) + "px 'Courier New', monospace";
  ctx.fillStyle = "#ffe14d";
  ctx.fillText("JUICE " + juiceLevel + ": " + JUICE_LAYERS[juiceLevel - 1], 10, 24);
  ctx.font = "11px 'Courier New', monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText("J = more juice   X = plain game", 10, HEIGHT - 8);
  ctx.restore();
}
