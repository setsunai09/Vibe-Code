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
let history = [];
let redoStack = [];
const MAX_HISTORY = 30;
let recentColors = [];

/* ---- Canvas setup ---- */
canvas.width = CANVAS_DISPLAY_SIZE;
canvas.height = CANVAS_DISPLAY_SIZE;
canvas.style.width = CANVAS_DISPLAY_SIZE + "px";
canvas.style.height = CANVAS_DISPLAY_SIZE + "px";

/* ---- White background ---- */
ctx.fillStyle = "#FFFFFF";
ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  if (currentTool === "fill") return;
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

/* ---- Flood Fill (grid-level) ---- */
function isColorMatch(c1, c2) {
  const tolerance = 10;
  return Math.abs(c1[0] - c2[0]) <= tolerance &&
         Math.abs(c1[1] - c2[1]) <= tolerance &&
         Math.abs(c1[2] - c2[2]) <= tolerance &&
         Math.abs(c1[3] - c2[3]) <= tolerance;
}

function floodFill(startGridX, startGridY) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const startX = (startGridX * pixelSize) + (pixelSize / 2);
  const startY = (startGridY * pixelSize) + (pixelSize / 2);
  const startIdx = (Math.floor(startY) * canvas.width + Math.floor(startX)) * 4;

  const targetColor = [data[startIdx], data[startIdx + 1], data[startIdx + 2], data[startIdx + 3]];

  const hex = currentColor.replace("#", "");
  const fillColor = [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
    255
  ];

  if (isColorMatch(targetColor, fillColor)) return;

  const stack = [[startGridX, startGridY]];
  const visited = new Set();
  const cols = canvas.width / pixelSize;
  const rows = canvas.height / pixelSize;

  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;

    const checkX = (cx * pixelSize) + (pixelSize / 2);
    const checkY = (cy * pixelSize) + (pixelSize / 2);
    const idx = (Math.floor(checkY) * canvas.width + Math.floor(checkX)) * 4;
    const currentColorData = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];

    if (isColorMatch(currentColorData, targetColor)) {
      ctx.fillStyle = currentColor;
      ctx.fillRect(cx * pixelSize, cy * pixelSize, pixelSize, pixelSize);

      stack.push([cx + 1, cy]);
      stack.push([cx - 1, cy]);
      stack.push([cx, cy + 1]);
      stack.push([cx, cy - 1]);
    }
  }
}

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

/* ---- Drawing helpers ---- */
function startDraw(e) {
  if (currentTool === "fill" || currentTool === "picker") return;
  drawing = true;
  saveState();
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
  if (!drawing || currentTool === "fill") return;

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

/* ---- Save / Load ---- */
function saveCanvas() {
  try {
    localStorage.setItem("pixelArtCanvas_" + resolution, canvas.toDataURL("image/png"));
    localStorage.setItem("pixelArtResolution", resolution);
  } catch (e) {
    /* localStorage is full or disabled */
  }
}

function loadCanvas(res) {
  const data = localStorage.getItem("pixelArtCanvas_" + res);
  if (!data) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
  };
  img.src = data;
}

/* ---- Undo / Redo History ---- */
function saveState() {
  /* New drawing clears redo stack */
  redoStack = [];
  history.push(ctx.getImageData(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE));
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function undo() {
  if (history.length === 0) return;
  redoStack.push(ctx.getImageData(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE));
  const state = history.pop();
  ctx.putImageData(state, 0, 0);
  saveCanvas();
}

function redo() {
  if (redoStack.length === 0) return;
  history.push(ctx.getImageData(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE));
  const state = redoStack.pop();
  ctx.putImageData(state, 0, 0);
  saveCanvas();
}

/* ---- Resolution change ---- */
function setResolution(newRes) {
  /* Save current resolution's canvas before switching */
  saveCanvas();

  resolution = newRes;
  pixelSize = CANVAS_DISPLAY_SIZE / resolution;
  canvas.width = CANVAS_DISPLAY_SIZE;
  canvas.height = CANVAS_DISPLAY_SIZE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  drawGrid();

  /* Load the new resolution's canvas */
  loadCanvas(resolution);
}

/* ---- Color System ---- */
const colorPreview = document.getElementById("colorPreview");
const colorHex = document.getElementById("colorHex");
const colorPickerPopup = document.getElementById("colorPickerPopup");
const customColorInput = document.getElementById("customColor");
const recentColorsRow = document.getElementById("recentColorsRow");

function setColor(color) {
  currentColor = color;
  colorPreview.style.backgroundColor = color;
  colorHex.textContent = color.toUpperCase();
  customColorInput.value = color;

  /* Add to recent colors */
  recentColors = recentColors.filter((c) => c !== color);
  recentColors.unshift(color);
  if (recentColors.length > 6) recentColors.pop();
  saveRecentColors();
  renderRecentColors();
}

function saveRecentColors() {
  try {
    localStorage.setItem("pixelArtRecentColors", JSON.stringify(recentColors));
  } catch (e) {
    /* localStorage is full or disabled */
  }
}

function loadRecentColors() {
  try {
    const data = localStorage.getItem("pixelArtRecentColors");
    if (data) {
      recentColors = JSON.parse(data);
    }
  } catch (e) {
    recentColors = [];
  }
}

function renderRecentColors() {
  recentColorsRow.innerHTML = "";
  recentColors.forEach((color) => {
    const btn = document.createElement("button");
    btn.className = "recent-color";
    btn.style.backgroundColor = color;
    btn.addEventListener("click", () => setColor(color));
    recentColorsRow.appendChild(btn);
  });
}

/* Color picker popup toggle */
colorPreview.addEventListener("click", () => {
  colorPickerPopup.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-picker-wrapper")) {
    colorPickerPopup.classList.remove("open");
  }
});

/* Custom color input */
customColorInput.addEventListener("input", () => {
  setColor(customColorInput.value);
});

/* Base colors */
document.querySelectorAll(".base-color").forEach((btn) => {
  btn.addEventListener("click", () => {
    setColor(btn.dataset.color);
  });
});

/* ---- Pipette Tool ---- */
canvas.addEventListener("click", (e) => {
  if (currentTool !== "picker") return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = "#" + [pixel[0], pixel[1], pixel[2]].map((c) => c.toString(16).padStart(2, "0")).join("");
  setColor(hex);

  /* Switch back to brush */
  currentTool = "brush";
  toolBtns.forEach((b) => {
    b.classList.remove("tool-btn--active");
    if (b.dataset.tool === "brush") b.classList.add("tool-btn--active");
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

/* ---- Undo / Redo ---- */
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

/* ---- Keyboard shortcuts ---- */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
    e.preventDefault();
    redo();
  }
});

/* ---- Clear Canvas ---- */
document.getElementById("clearBtn").addEventListener("click", () => {
  ctx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
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

/* ---- Fill Tool Click ---- */
canvas.addEventListener("click", (e) => {
  if (currentTool !== "fill") return;

  saveState();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cell = snapToGrid(x, y);
  floodFill(cell.x, cell.y);
  saveCanvas();
});

/* ---- Init ---- */
const savedRes = parseInt(localStorage.getItem("pixelArtResolution"), 10);
if (savedRes && RESOLUTIONS.includes(savedRes)) {
  resolution = savedRes;
  resolutionSelect.value = resolution;
}

pixelSize = CANVAS_DISPLAY_SIZE / resolution;
drawGrid();
loadCanvas(resolution);

loadRecentColors();
renderRecentColors();
setColor(currentColor);
