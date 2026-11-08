const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

/* ---- Constants ---- */
const CANVAS_DISPLAY_SIZE = 512;
const RESOLUTIONS = [16, 32, 64];

/* ---- State ---- */
let resolution = 32;
let pixelSize = CANVAS_DISPLAY_SIZE / resolution;
let drawing = false;
let currentTool = "brush";
let currentColor = "#000000";
let brushSize = 1;
let lastGridX = -1;
let lastGridY = -1;

/* ---- Canvas setup ---- */
canvas.width = CANVAS_DISPLAY_SIZE;
canvas.height = CANVAS_DISPLAY_SIZE;
canvas.style.width = CANVAS_DISPLAY_SIZE + "px";
canvas.style.height = CANVAS_DISPLAY_SIZE + "px";

/* ---- Grid snapping ---- */
function snapToGrid(x, y) {
  const gridX = Math.floor(x / pixelSize);
  const gridY = Math.floor(y / pixelSize);
  return {
    x: Math.max(0, Math.min(gridX, resolution - 1)),
    y: Math.max(0, Math.min(gridY, resolution - 1)),
  };
}

/* ---- Draw a single pixel cell ---- */
function fillCell(gridX, gridY) {
  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = currentColor;
  }
  ctx.fillRect(
    gridX * pixelSize,
    gridY * pixelSize,
    pixelSize,
    pixelSize
  );
}

/* ---- Draw brush area (square around cursor) ---- */
function drawBrushAt(gridX, gridY) {
  const half = Math.floor(brushSize / 2);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const gx = gridX + dx;
      const gy = gridY + dy;
      if (gx >= 0 && gx < resolution && gy >= 0 && gy < resolution) {
        fillCell(gx, gy);
      }
    }
  }
}

/* ---- Bresenham line to connect two grid cells ---- */
function drawLineBetween(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    fillCell(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/* ---- Drawing handlers ---- */
function startDraw(e) {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cell = snapToGrid(x, y);
  drawBrushAt(cell.x, cell.y);
  lastGridX = cell.x;
  lastGridY = cell.y;
}

function stopDraw() {
  drawing = false;
  saveCanvas();
}

function draw(e) {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cell = snapToGrid(x, y);

  if (cell.x !== lastGridX || cell.y !== lastGridY) {
    drawLineBetween(lastGridX, lastGridY, cell.x, cell.y);
    drawBrushAt(cell.x, cell.y);
    lastGridX = cell.x;
    lastGridY = cell.y;
  }
}

/* ---- Draw grid lines ---- */
function drawGrid() {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < resolution; i++) {
    const pos = i * pixelSize;
    ctx.moveTo(pos + 0.5, 0);
    ctx.lineTo(pos + 0.5, CANVAS_DISPLAY_SIZE);
    ctx.moveTo(0, pos + 0.5);
    ctx.lineTo(CANVAS_DISPLAY_SIZE, pos + 0.5);
  }
  ctx.stroke();
}

/* ---- Resolution change ---- */
function setResolution(newRes) {
  resolution = newRes;
  pixelSize = CANVAS_DISPLAY_SIZE / resolution;
  canvas.width = CANVAS_DISPLAY_SIZE;
  canvas.height = CANVAS_DISPLAY_SIZE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  drawGrid();
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

/* ---- Resolution Select ---- */
const resolutionSelect = document.getElementById("resolutionSelect");

resolutionSelect.addEventListener("change", () => {
  setResolution(parseInt(resolutionSelect.value, 10));
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
  ctx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  drawGrid();
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

/* ---- Init ---- */
drawGrid();
loadCanvas();
