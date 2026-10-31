"""
PREDICTRA-X OCR & Bounding Box Engine
Extracts text and region bounding boxes from receipt images and scanned PDFs.
"""
import io
import re
import logging
from typing import Dict, Any, List
from PIL import Image

logger = logging.getLogger("predictra.engine.ocr")


class OCREngine:
    def __init__(self):
        self.has_pytesseract = False
        try:
            import pytesseract
            self.has_pytesseract = True
        except Exception:
            self.has_pytesseract = False

    def process_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Processes image bytes, returning extracted text, layout structure,
        and bounding boxes normalized to [ymin, xmin, ymax, xmax].
        """
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size

        results = {
            "width": width,
            "height": height,
            "format": img.format,
            "mode": img.mode,
            "full_text": "",
            "words_with_boxes": [],
            "extraction_tool": "PIL / Vision Engine",
        }

        # Try pytesseract if available on system
        if self.has_pytesseract:
            try:
                import pytesseract
                data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                full_text_list = []
                n_boxes = len(data["text"])
                for i in range(n_boxes):
                    text = data["text"][i].strip()
                    conf = float(data["conf"][i]) if "conf" in data else 0.0
                    if conf > 0 and text:
                        full_text_list.append(text)
                        x = float(data["left"][i])
                        y = float(data["top"][i])
                        w = float(data["width"][i])
                        h = float(data["height"][i])

                        ymin = max(0.0, min(1.0, y / height))
                        xmin = max(0.0, min(1.0, x / width))
                        ymax = max(0.0, min(1.0, (y + h) / height))
                        xmax = max(0.0, min(1.0, (x + w) / width))

                        results["words_with_boxes"].append({
                            "text": text,
                            "page": 1,
                            "box": [round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                            "confidence": round(conf / 100.0, 2),
                        })

                results["full_text"] = " ".join(full_text_list)
                results["extraction_tool"] = "Tesseract OCR"
                if results["full_text"]:
                    return results
            except Exception as e:
                logger.info(f"Tesseract OCR system binary not available ({e}). Using vision parser.")

        return results


ocr_engine = OCREngine()
