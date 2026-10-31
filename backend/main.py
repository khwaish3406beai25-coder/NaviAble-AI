"""
NaviAble AI — YOLO Object Detection Backend
============================================
FastAPI server that runs pretrained YOLOv8n inference on images
sent as base64-encoded JSON.

Run:
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

The model weights (yolov8n.pt, ~6 MB) are downloaded automatically
by Ultralytics on first run if not already present.
"""

import base64
import io
import logging
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NaviAble AI — YOLO Detection", version="1.0.0")

# Allow all origins and methods so the Expo app can reach the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup. Ultralytics downloads yolov8n.pt automatically
# on first run (~6 MB). Subsequent runs reuse the cached file.
logger.info("Loading YOLOv8n model...")
model = YOLO("yolov8n.pt")
logger.info("YOLOv8n model ready.")


class DetectRequest(BaseModel):
    """Incoming request: base64-encoded image."""
    image: str          # base64 string
    mime_type: str = "image/jpeg"
    confidence: float = 0.35   # minimum confidence threshold


class Detection(BaseModel):
    label: str
    confidence: float
    bbox: List[float]   # [x1, y1, x2, y2] in pixels


class DetectResponse(BaseModel):
    detections: List[Detection]
    count: int
    summary: str        # human-readable sentence for TTS / display


@app.get("/health")
def health():
    return {"status": "ok", "model": "yolov8n"}


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    # ── Decode image ────────────────────────────────────────────────────────
    try:
        # Strip data URL prefix if present (e.g., 'data:image/jpeg;base64,')
        raw_b64 = req.image.split(",")[-1] if "," in req.image else req.image
        image_bytes = base64.b64decode(raw_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        logger.error("Image decode failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid image data.")

    # ── Run YOLO inference ───────────────────────────────────────────────────
    try:
        results = model.predict(
            source=image,
            conf=req.confidence,
            verbose=False,
        )
    except Exception as exc:
        logger.error("YOLO inference failed: %s", exc)
        raise HTTPException(status_code=500, detail="Inference failed.")

    # ── Parse detections ─────────────────────────────────────────────────────
    detections: List[Detection] = []
    result = results[0]

    for box in result.boxes:
        cls_id = int(box.cls[0].item())
        label = model.names[cls_id]
        conf = round(float(box.conf[0].item()), 3)
        x1, y1, x2, y2 = [round(v, 1) for v in box.xyxy[0].tolist()]
        detections.append(Detection(label=label, confidence=conf, bbox=[x1, y1, x2, y2]))

    # Sort by confidence descending
    detections.sort(key=lambda d: d.confidence, reverse=True)

    # ── Build summary sentence ───────────────────────────────────────────────
    if detections:
        # Deduplicate labels while preserving order
        seen = {}
        for d in detections:
            if d.label not in seen:
                seen[d.label] = 0
            seen[d.label] += 1

        parts = []
        for label, count in seen.items():
            parts.append(f"{count} {label}" if count > 1 else label)

        if len(parts) == 1:
            summary = f"Detected: {parts[0]}."
        elif len(parts) == 2:
            summary = f"Detected: {parts[0]} and {parts[1]}."
        else:
            summary = f"Detected: {', '.join(parts[:-1])}, and {parts[-1]}."
    else:
        summary = "No objects detected with sufficient confidence."

    return DetectResponse(
        detections=detections,
        count=len(detections),
        summary=summary,
    )
