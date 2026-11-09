const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

/* ---- Constants ---- */
const CANVAS_DISPLAY_SIZE = 512;
const RESOLUTIONS = [8, 16, 24, 32, 48, 64, 96, 128];

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

function saveReference() {
  try {
    const data = {
      src: referenceImage.src,
      position: referencePosition,
      scale: referenceScale,
      rotation: referenceRotation,
      opacity: referenceOpacity,
      onFront: referenceOnFront,
    };
    localStorage.setItem("pixelArtReference", JSON.stringify(data));
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

function loadReference() {
  const data = localStorage.getItem("pixelArtReference");
  if (!data) return;
  try {
    const ref = JSON.parse(data);
    if (!ref.src) return;

    /* Set display states synchronously */
    referenceImage.src = ref.src;
    referenceContainer.classList.add("visible");
    referenceBtn.style.display = "none";
    referenceToggle.style.display = "block";
    referenceControls.style.display = "flex";
    referenceVisible = true;

    /* Set values synchronously */
    referencePosition = ref.position || { x: 0, y: 0 };
    referenceScale = ref.scale || 100;
    referenceRotation = ref.rotation || 0;
    referenceOpacity = ref.opacity || 50;
    referenceOnFront = ref.onFront || false;

    if (referenceOnFront) {
      referenceContainer.style.zIndex = 20;
      referenceContainer.style.pointerEvents = "auto";
      referenceFrontBtn.textContent = "Выключить";
      referenceFrontBtn.classList.add("active");
    } else {
      referenceContainer.style.zIndex = 5;
      referenceContainer.style.pointerEvents = "none";
      referenceFrontBtn.textContent = "Включить";
      referenceFrontBtn.classList.remove("active");
    }

    referenceOpacitySlider.value = referenceOpacity;
    referenceScaleSlider.value = referenceScale;
    referenceRotateSlider.value = referenceRotation;
    opacityNumber.value = referenceOpacity;
    scaleNumber.value = referenceScale;
    rotateNumber.value = Math.round(referenceRotation);

    /* Wait for image to load before transforming */
    if (referenceImage.complete && referenceImage.naturalWidth > 0) {
      originalImageWidth = referenceImage.naturalWidth;
      originalImageHeight = referenceImage.naturalHeight;
      updateReferenceTransform();
      requestAnimationFrame(() => updateHandlePositions());
    } else {
      referenceImage.onload = () => {
        originalImageWidth = referenceImage.naturalWidth;
        originalImageHeight = referenceImage.naturalHeight;
        updateReferenceTransform();
        requestAnimationFrame(() => updateHandlePositions());
      };
    }
  } catch (e) {
    /* Invalid data */
  }
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
  /* Clear canvas */
  ctx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  drawGrid();
  saveCanvas();

  /* Clear reference image */
  referenceImage.src = "";
  referenceContainer.classList.remove("visible");
  referenceBtn.style.display = "block";
  referenceToggle.style.display = "none";
  referenceControls.style.display = "none";
  referenceVisible = false;
  referenceOnFront = false;
  referenceContainer.style.zIndex = 5;
  referenceFrontBtn.textContent = "Включить";
  referenceFrontBtn.classList.remove("active");
  localStorage.removeItem("pixelArtReference");
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

/* ---- Reference Image ---- */
const referenceContainer = document.getElementById("referenceContainer");
const referenceImage = document.getElementById("referenceImage");
const referenceFileInput = document.getElementById("referenceFileInput");
const referenceBtn = document.getElementById("referenceBtn");
const referenceToggle = document.getElementById("referenceToggle");
const referenceControls = document.getElementById("referenceControls");
const referenceOpacitySlider = document.querySelector(".reference-opacity");
const referenceScaleSlider = document.querySelector(".reference-scale");
const referenceRotateSlider = document.querySelector(".reference-rotate");
const opacityNumber = document.getElementById("opacityNumber");
const scaleNumber = document.getElementById("scaleNumber");
const rotateNumber = document.getElementById("rotateNumber");
let referenceVisible = false;
let referenceDragging = false;
let referenceDragOffset = { x: 0, y: 0 };
let referencePosition = { x: 0, y: 0 };
let referenceScale = 100;
let referenceRotation = 0;
let referenceOpacity = 50;
let originalImageWidth = 0;
let originalImageHeight = 0;

function updateReferenceTransform() {
  referenceWrapper.style.transform = `translate(${referencePosition.x}px, ${referencePosition.y}px) scale(${referenceScale / 100}) rotate(${referenceRotation}deg)`;
  referenceImage.style.opacity = referenceOpacity / 100;
  updateHandlePositions();
}

function updateHandlePositions() {
  const img = referenceImage;
  const w = img.offsetWidth;
  const h = img.offsetHeight;

  const half = 6;

  const positions = {
    handleRotate: { left: w / 2 - 8, top: -24 },
    handleNW: { left: -half, top: -half },
    handleNE: { left: w - half, top: -half },
    handleSW: { left: -half, top: h - half },
    handleSE: { left: w - half, top: h - half },
    handleN: { left: w / 2 - half, top: -half },
    handleS: { left: w / 2 - half, top: h - half },
    handleE: { left: w - half, top: h / 2 - half },
    handleW: { left: -half, top: h / 2 - half },
  };

  Object.entries(positions).forEach(([id, pos]) => {
    const handle = document.getElementById(id);
    if (handle) {
      handle.style.left = pos.left + "px";
      handle.style.top = pos.top + "px";
      handle.style.right = "auto";
      handle.style.bottom = "auto";
      handle.style.transform = "none";
    }
  });
}

referenceBtn.addEventListener("click", () => {
  referenceFileInput.click();
});

referenceFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    referenceImage.src = ev.target.result;
    referenceImage.onload = () => {
      originalImageWidth = referenceImage.naturalWidth;
      originalImageHeight = referenceImage.naturalHeight;
      referenceContainer.classList.add("visible");
      referenceBtn.style.display = "none";
      referenceToggle.style.display = "block";
      referenceControls.style.display = "flex";
      referenceVisible = true;
      referencePosition = { x: 0, y: 0 };
      referenceScale = 100;
      referenceRotation = 0;
      referenceOpacity = 50;
      referenceOpacitySlider.value = 50;
      referenceScaleSlider.value = 100;
      referenceRotateSlider.value = 0;
      updateReferenceTransform();
      requestAnimationFrame(() => updateHandlePositions());
      saveReference();
    };
  };
  reader.readAsDataURL(file);
});

referenceToggle.addEventListener("click", () => {
  referenceVisible = !referenceVisible;
  if (referenceVisible) {
    referenceContainer.classList.add("visible");
    referenceBtn.style.display = "none";
    referenceToggle.textContent = "Скрыть";
  } else {
    referenceContainer.classList.remove("visible");
    referenceBtn.style.display = "block";
    referenceToggle.textContent = "Показать";
  }
});

/* ---- Reference Front/Back Toggle ---- */
let referenceOnFront = false;
const referenceFrontBtn = document.getElementById("referenceFrontBtn");

referenceFrontBtn.addEventListener("click", () => {
  referenceOnFront = !referenceOnFront;
  if (referenceOnFront) {
    referenceContainer.style.zIndex = 20;
    referenceContainer.style.pointerEvents = "auto";
    referenceFrontBtn.textContent = "Выключить";
    referenceFrontBtn.classList.add("active");
  } else {
    referenceContainer.style.zIndex = 5;
    referenceContainer.style.pointerEvents = "none";
    referenceFrontBtn.textContent = "Включить";
    referenceFrontBtn.classList.remove("active");
  }
});

referenceOpacitySlider.addEventListener("input", () => {
  referenceOpacity = parseInt(referenceOpacitySlider.value, 10);
  opacityNumber.value = referenceOpacity;
  updateReferenceTransform();
  saveReference();
});

referenceScaleSlider.addEventListener("input", () => {
  referenceScale = parseInt(referenceScaleSlider.value, 10);
  scaleNumber.value = referenceScale;
  updateReferenceTransform();
  saveReference();
});

referenceRotateSlider.addEventListener("input", () => {
  referenceRotation = parseInt(referenceRotateSlider.value, 10);
  rotateNumber.value = referenceRotation;
  updateReferenceTransform();
  saveReference();
});

/* Number inputs */
opacityNumber.addEventListener("change", () => {
  referenceOpacity = Math.max(0, Math.min(100, parseInt(opacityNumber.value, 10) || 0));
  referenceOpacitySlider.value = referenceOpacity;
  updateReferenceTransform();
  saveReference();
});

scaleNumber.addEventListener("change", () => {
  referenceScale = Math.max(10, Math.min(300, parseInt(scaleNumber.value, 10) || 100));
  referenceScaleSlider.value = referenceScale;
  updateReferenceTransform();
  saveReference();
});

rotateNumber.addEventListener("change", () => {
  referenceRotation = Math.max(-180, Math.min(180, parseInt(rotateNumber.value, 10) || 0));
  referenceRotateSlider.value = referenceRotation;
  updateReferenceTransform();
  saveReference();
});

/* Drag reference image */
referenceImage.addEventListener("mousedown", (e) => {
  if (!referenceVisible) return;
  e.preventDefault();
  referenceContainer.style.zIndex = 20;
  referenceDragging = true;
  const rect = referenceContainer.getBoundingClientRect();
  referenceDragOffset.x = e.clientX - rect.left - referencePosition.x;
  referenceDragOffset.y = e.clientY - rect.top - referencePosition.y;
  referenceImage.style.cursor = "grabbing";
});

/* Prevent native drag */
referenceImage.addEventListener("dragstart", (e) => e.preventDefault());

/* ---- Resize/Rotate Handles ---- */
const referenceWrapper = document.getElementById("referenceWrapper");
const handleRotate = document.getElementById("handleRotate");
const handleNW = document.getElementById("handleNW");
const handleNE = document.getElementById("handleNE");
const handleSW = document.getElementById("handleSW");
const handleSE = document.getElementById("handleSE");
const handleN = document.getElementById("handleN");
const handleS = document.getElementById("handleS");
const handleE = document.getElementById("handleE");
const handleW = document.getElementById("handleW");

let referenceResizing = false;
let referenceRotating = false;
let referenceResizeHandle = "";

/* Resize start state */
let resizeStart = {
  mouseX: 0,
  mouseY: 0,
  width: 0,
  height: 0,
  posX: 0,
  posY: 0,
  rotation: 0,
};

/* Rotate start state */
let rotateStart = {
  centerX: 0,
  centerY: 0,
  startAngle: 0,
  startRotation: 0,
};

/* ---- ROTATE ---- */
handleRotate.addEventListener("mousedown", (e) => {
  if (!referenceVisible) return;
  e.preventDefault();
  e.stopPropagation();
  referenceRotating = true;
  const rect = referenceImage.getBoundingClientRect();
  rotateStart.centerX = rect.left + rect.width / 2;
  rotateStart.centerY = rect.top + rect.height / 2;
  rotateStart.startAngle = Math.atan2(e.clientY - rotateStart.centerY, e.clientX - rotateStart.centerX) * (180 / Math.PI);
  rotateStart.startRotation = referenceRotation;
});

/* ---- RESIZE ---- */
function getRenderedSize() {
  const rect = referenceImage.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

function resizeFromHandle(handle, mouseX, mouseY, event) {
  const angleRad = resizeStart.rotation * (Math.PI / 180);
  const cosA = Math.cos(-angleRad);
  const sinA = Math.sin(-angleRad);

  const dx = mouseX - resizeStart.mouseX;
  const dy = mouseY - resizeStart.mouseY;

  // 1. Движение мыши в локальных координатах картинки
  const localDx = dx * cosA - dy * sinA;
  const localDy = dx * sinA + dy * cosA;

  const w0 = resizeStart.w0;
  const h0 = resizeStart.h0;
  const startScale = resizeStart.scale / 100;

  const startW = w0 * startScale;
  const startH = h0 * startScale;

  let newW = startW;
  let newH = startH;

  // 2. Вычисляем новые размеры (привязка 1 в 1 к мыши)
  if (handle.includes("E")) newW = startW + localDx;
  if (handle.includes("W")) newW = startW - localDx;
  if (handle.includes("S")) newH = startH + localDy;
  if (handle.includes("N")) newH = startH - localDy;

  newW = Math.max(20, newW);
  newH = Math.max(20, newH);

  // Пропорции с Shift
  if (event && event.shiftKey && handle.length === 2) {
    const ratio = w0 / h0;
    if (newW / newH > ratio) newH = newW / ratio;
    else newW = newH * ratio;
  }

  // 3. Новый масштаб в процентах
  let newScalePercent = (newW / w0) * 100;
  if (handle === "N" || handle === "S") {
    newScalePercent = (newH / h0) * 100;
  }

  // Ограничиваем масштаб от 10% до 300%
  newScalePercent = Math.max(10, Math.min(300, newScalePercent));
  newScalePercent = Math.round(newScalePercent);
  const newScale = newScalePercent / 100;

  // 4. Считаем финальные размеры с учетом ограничений
  const finalW = w0 * newScale;
  const finalH = h0 * newScale;

  // 5. Насколько изменился размер?
  const deltaW = finalW - startW;
  const deltaH = finalH - startH;

  // 6. Сдвиг центра ВСЕГДА равен половине изменения размера!
  let shiftLocalX = 0;
  let shiftLocalY = 0;

  if (handle.includes("E")) shiftLocalX = deltaW / 2;
  if (handle.includes("W")) shiftLocalX = -deltaW / 2;
  if (handle.includes("S")) shiftLocalY = deltaH / 2;
  if (handle.includes("N")) shiftLocalY = -deltaH / 2;

  // 7. Поворачиваем этот сдвиг обратно в глобальные координаты
  const cosR = Math.cos(angleRad);
  const sinR = Math.sin(angleRad);
  const globalShiftX = shiftLocalX * cosR - shiftLocalY * sinR;
  const globalShiftY = shiftLocalX * sinR + shiftLocalY * cosR;

  // 8. Применяем изменения
  referencePosition.x = resizeStart.posX + globalShiftX;
  referencePosition.y = resizeStart.posY + globalShiftY;

  referenceScale = newScalePercent;
  referenceScaleSlider.value = referenceScale;
  scaleNumber.value = Math.round(referenceScale);

  updateReferenceTransform();
}

[handleNW, handleNE, handleSW, handleSE, handleN, handleS, handleE, handleW].forEach((handle) => {
  handle.addEventListener("mousedown", (e) => {
    if (!referenceVisible) return;
    e.preventDefault();
    e.stopPropagation();
    referenceResizing = true;
    referenceResizeHandle = handle.id.replace("handle", "");
    resizeStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      scale: referenceScale,
      posX: referencePosition.x,
      posY: referencePosition.y,
      rotation: referenceRotation,
      w0: referenceImage.offsetWidth,
      h0: referenceImage.offsetHeight,
    };
  });
});

/* ---- GLOBAL mousemove ---- */
document.addEventListener("mousemove", (e) => {
  /* Rotation */
  if (referenceRotating) {
    const currentAngle = Math.atan2(e.clientY - rotateStart.centerY, e.clientX - rotateStart.centerX) * (180 / Math.PI);
    const delta = currentAngle - rotateStart.startAngle;
    referenceRotation = Math.max(-180, Math.min(180, rotateStart.startRotation + delta));
    referenceRotateSlider.value = referenceRotation;
    rotateNumber.value = Math.round(referenceRotation);
    updateReferenceTransform();
    saveReference();
    return;
  }

  /* Resize */
  if (referenceResizing) {
    resizeFromHandle(referenceResizeHandle, e.clientX, e.clientY, e);
    return;
  }

  /* Drag */
  if (referenceDragging) {
    e.preventDefault();
    const rect = referenceContainer.getBoundingClientRect();
    referencePosition.x = e.clientX - rect.left - referenceDragOffset.x;
    referencePosition.y = e.clientY - rect.top - referenceDragOffset.y;
    updateReferenceTransform();
    saveReference();
  }
});

/* ---- GLOBAL mouseup ---- */
document.addEventListener("mouseup", () => {
  referenceRotating = false;
  referenceResizing = false;
  referenceDragging = false;
  referenceContainer.style.zIndex = 5;
  referenceImage.style.cursor = "move";
});

/* ---- Load reference on start ---- */
loadReference();
