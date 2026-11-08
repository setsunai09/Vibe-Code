const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

/* ---- Canvas size ---- */
const CANVAS_W = 700;
const CANVAS_H = 500;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

/* ---- Disable smoothing for pixel look ---- */
ctx.imageSmoothingEnabled = false;

/* ---- State ---- */
let drawing = false;
let currentTool = "brush";
let currentColor = "#000000";
let brushSize = 3;
let lastX = 0;
let lastY = 0;

/* ---- Drawing helpers ---- */
function startDraw(e) {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  drawPixel(lastX, lastY);
}

function stopDraw() {
  drawing = false;
  saveCanvas();
}

function drawPixel(x, y) {
  const size = brushSize;
  const half = Math.floor(size / 2);

  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = currentColor;
  }

  ctx.fillRect(Math.round(x - half), Math.round(y - half), size, size);
}

function drawLine(x, y) {
  const dx = x - lastX;
  const dy = y - lastY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(Math.ceil(dist / brushSize), 1);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = lastX + dx * t;
    const py = lastY + dy * t;
    drawPixel(px, py);
  }

  lastX = x;
  lastY = y;
}

function draw(e) {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  drawLine(x, y);
}

/* ---- Save / Load ---- */
function saveCanvas() {
  try {
    localStorage.setItem("pixelArtCanvas", canvas.toDataURL("image/png"));
  } catch (e) {
    /* localStorage is full or disabled */
  }
}

function loadCanvas() {
  const data = localStorage.getItem("pixelArtCanvas");
  if (!data) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
  };
  img.src = data;
}

/* ---- Palette ---- */
const swatches = document.querySelectorAll(".color-swatch");

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    swatches.forEach((s) => s.classList.remove("color-swatch--active"));
    swatch.classList.add("color-swatch--active");
    currentColor = swatch.dataset.color;
  });
});

/* ---- Brush Size ---- */
const brushSlider = document.querySelector(".brush-size");
const brushValue = document.querySelector(".brush-size-value");

brushSlider.addEventListener("input", () => {
  brushSize = parseInt(brushSlider.value, 10);
  brushValue.textContent = brushSize;
});

/* ---- Tool Buttons ---- */
const toolBtns = document.querySelectorAll(".tool-btn");

toolBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    toolBtns.forEach((b) => b.classList.remove("tool-btn--active"));
    btn.classList.add("tool-btn--active");
    currentTool = btn.dataset.tool;
  });
});

/* ---- Clear Canvas ---- */
document.getElementById("clearBtn").addEventListener("click", () => {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  saveCanvas();
});

/* ---- Download ---- */
document.getElementById("downloadBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "pixel-art.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

/* ---- Mouse Events ---- */
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseleave", stopDraw);

/* ---- Load saved drawing on start ---- */
loadCanvas();
