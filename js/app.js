const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

/* ---- Canvas size ---- */
const CANVAS_W = 700;
const CANVAS_H = 500;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

/* ---- State ---- */
let drawing = false;
let currentTool = "brush";
let currentColor = "#000000";
let brushSize = 3;

/* ---- Drawing helpers ---- */
function startDraw(e) {
  drawing = true;
  draw(e);
}

function stopDraw() {
  drawing = false;
  ctx.beginPath();
}

function draw(e) {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineWidth = brushSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = currentColor;
  }

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
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
