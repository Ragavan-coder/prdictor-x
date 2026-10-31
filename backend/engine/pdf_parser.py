"""
PREDICTRA-X Docling & PDF Layout Parsing Engine
Uses pdfplumber and pypdf to extract layout structure, page tables,
and word-level bounding boxes.
"""
import io
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("predictra.engine.pdf")


class PDFParser:
    def parse_pdf_bytes(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Parses PDF bytes, returning text, page count, tables, and word-level
        normalized bounding boxes [ymin, xmin, ymax, xmax].
        """
        import pdfplumber

        results = {
            "page_count": 0,
            "pages": [],
            "full_text": "",
            "tables": [],
            "words_with_boxes": [],
        }

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            results["page_count"] = len(pdf.pages)
            full_text_parts = []

            for page_idx, page in enumerate(pdf.pages):
                width = float(page.width)
                height = float(page.height)
                page_text = page.extract_text() or ""
                full_text_parts.append(page_text)

                # Extract tables
                page_tables = page.extract_tables() or []
                for table in page_tables:
                    results["tables"].append({
                        "page": page_idx + 1,
                        "data": table,
                    })

                # Extract words with bounding box coordinates
                words = page.extract_words() or []
                for w in words:
                    # pdfplumber returns: x0, top, x1, bottom
                    x0 = float(w["x0"])
                    top = float(w["top"])
                    x1 = float(w["x1"])
                    bottom = float(w["bottom"])

                    # Normalize to 0.0 - 1.0
                    ymin = max(0.0, min(1.0, top / height))
                    xmin = max(0.0, min(1.0, x0 / width))
                    ymax = max(0.0, min(1.0, bottom / height))
                    xmax = max(0.0, min(1.0, x1 / width))

                    results["words_with_boxes"].append({
                        "text": w["text"],
                        "page": page_idx + 1,
                        "box": [round(ymin, 4), round(xmin, 4), round(ymax, 4), round(xmax, 4)],
                        "confidence": 0.98,
                    })

                results["pages"].append({
                    "page_number": page_idx + 1,
                    "width": width,
                    "height": height,
                    "text": page_text,
                    "word_count": len(words),
                })

            results["full_text"] = "\n".join(full_text_parts)

        return results


pdf_parser = PDFParser()
