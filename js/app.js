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

/* ---- Events ---- */
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseleave", stopDraw);
