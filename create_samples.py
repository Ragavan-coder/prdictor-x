"""
Generates test fixtures for PREDICTRA-X:
- Valid SBI FDR PDF with vector text and layout
- Valid HDFC FDR JPEG receipt
- Corrupted PDF fixture
- Disguised/invalid extension fixtures
"""
import os
import io
from PIL import Image, ImageDraw, ImageFont

samples_dir = os.path.join(os.path.dirname(__file__), "samples")
os.makedirs(samples_dir, exist_ok=True)

# ------------------------------------------------------------------------------
# 1. Generate Valid SBI FDR PDF
# ------------------------------------------------------------------------------
sbi_pdf_path = os.path.join(samples_dir, "sbi_fdr_sample.pdf")

# Generate standard PDF format with text stream
pdf_content = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
    b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
    b"5 0 obj << /Length 550 >> stream\n"
    b"BT\n"
    b"/F1 16 Tf\n"
    b"50 720 Td (STATE BANK OF INDIA - FIXED DEPOSIT RECEIPT) Tj\n"
    b"/F1 11 Tf\n"
    b"0 -35 Td (Branch: Parliament Street, New Delhi | IFSC Code: SBIN0000691) Tj\n"
    b"0 -25 Td (Receipt No: FDR-2026-8812-SBI) Tj\n"
    b"0 -25 Td (Depositor: Ananya Sengupta | Customer ID: CIF-8849201) Tj\n"
    b"0 -25 Td (Principal Amount: Rs. 2,500,000.00 | Rate of Interest: 7.25% p.a.) Tj\n"
    b"0 -25 Td (Tenure: 36 Months | Compounding: Quarterly) Tj\n"
    b"0 -25 Td (Date of Deposit: 2024-06-10 | Maturity Date: 2027-06-10) Tj\n"
    b"0 -25 Td (Maturity Amount: Rs. 3,102,920.00) Tj\n"
    b"0 -35 Td (Authorised Signatory - State Bank of India Security Microprint) Tj\n"
    b"ET\n"
    b"endstream\n"
    b"endobj\n"
    b"xref\n"
    b"0 6\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"0000000244 00000 n \n"
    b"0000000318 00000 n \n"
    b"trailer << /Size 6 /Root 1 0 R >>\n"
    b"startxref\n"
    b"920\n"
    b"%%EOF\n"
)

with open(sbi_pdf_path, "wb") as f:
    f.write(pdf_content)
print(f"Created {sbi_pdf_path} ({len(pdf_content)} bytes)")

# ------------------------------------------------------------------------------
# 2. Generate Valid HDFC Bank FDR Image (JPG)
# ------------------------------------------------------------------------------
hdfc_jpg_path = os.path.join(samples_dir, "hdfc_fdr_sample.jpg")
img = Image.new("RGB", (800, 600), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

# Draw simulated FDR certificate
draw.rectangle([(20, 20), (780, 580)], outline=(200, 16, 46), width=3)
draw.rectangle([(26, 26), (774, 574)], outline=(180, 180, 180), width=1)

# Header
draw.text((50, 50), "HDFC BANK LIMITED - TERM DEPOSIT ADVICE", fill=(200, 16, 46))
draw.text((50, 80), "Fort Branch, Mumbai - 400001 | IFSC: HDFC0000060", fill=(80, 80, 80))
draw.line([(50, 105), (750, 105)], fill=(220, 220, 220), width=1)

# Fields
draw.text((50, 130), "Receipt Number: FDR-2026-9041-HDFC", fill=(20, 20, 20))
draw.text((50, 170), "Account Holder: Rajeshwar V. Sharma", fill=(20, 20, 20))
draw.text((50, 210), "Principal Deposit: Rs. 1,500,000.00", fill=(20, 20, 20))
draw.text((50, 250), "Interest Rate: 7.40% p.a. (Quarterly Compounded)", fill=(20, 20, 20))
draw.text((50, 290), "Date of Issue: 2025-01-15", fill=(20, 20, 20))
draw.text((50, 330), "Maturity Date: 2027-01-15", fill=(20, 20, 20))
draw.text((50, 370), "Maturity Sum Payable: Rs. 1,734,560.00", fill=(200, 16, 46))

# Seal / Sign
draw.ellipse([(600, 420), (720, 540)], outline=(0, 100, 200), width=2)
draw.text((615, 470), "HDFC BANK\nVERIFIED", fill=(0, 100, 200))

img.save(hdfc_jpg_path, "JPEG", quality=95)
print(f"Created {hdfc_jpg_path}")

# ------------------------------------------------------------------------------
# 3. Generate Corrupted PDF Fixture
# ------------------------------------------------------------------------------
corrupt_pdf_path = os.path.join(samples_dir, "corrupted_sample.pdf")
with open(corrupt_pdf_path, "wb") as f:
    f.write(b"%PDF-1.4\nGARBAGE_UNREADABLE_STREAM_CORRUPT_EOF_TRUNCATED")
print(f"Created {corrupt_pdf_path}")

# ------------------------------------------------------------------------------
# 4. Generate Fake Extension Fixture (EXE / script with .pdf name)
# ------------------------------------------------------------------------------
fake_ext_path = os.path.join(samples_dir, "disguised_script.pdf")
with open(fake_ext_path, "wb") as f:
    f.write(b"#!/bin/bash\necho 'Disguised executable disguised as PDF'\nexit 1\n")
print(f"Created {fake_ext_path}")

# ------------------------------------------------------------------------------
# 5. Generate Unsupported File Extension Fixture
# ------------------------------------------------------------------------------
unsupported_path = os.path.join(samples_dir, "malicious_payload.exe")
with open(unsupported_path, "wb") as f:
    f.write(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00")
print(f"Created {unsupported_path}")
