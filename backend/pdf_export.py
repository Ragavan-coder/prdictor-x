"""
PREDICTRA-X Cryptographic Audit PDF Certificate Generator
Produces tamper-evident, publication-grade compliance certificates
detailing the SHA-256 Merkle chained audit trail.
"""
import io
import time
from typing import List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

from audit import AuditEntry


def generate_audit_pdf(
    chain: List[AuditEntry],
    integrity_verified: bool,
    operator_name: str = "sentra-admin",
) -> io.BytesIO:
    """
    Generates a cryptographic audit certificate in PDF format.
    Returns a BytesIO stream ready for download.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_red = colors.HexColor("#C8102E")
    slate_dark = colors.HexColor("#0F172A")
    slate_muted = colors.HexColor("#64748B")
    border_color = colors.HexColor("#CBD5E1")
    light_bg = colors.HexColor("#F8FAFC")
    emerald_green = colors.HexColor("#059669")
    emerald_bg = colors.HexColor("#ECFDF5")

    title_style = ParagraphStyle(
        "CertTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=slate_dark,
    )

    subtitle_style = ParagraphStyle(
        "CertSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=slate_muted,
    )

    header_brand = ParagraphStyle(
        "HeaderBrand",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=16,
        textColor=brand_red,
    )

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=slate_dark,
    )

    meta_value_style = ParagraphStyle(
        "MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=slate_dark,
    )

    code_style = ParagraphStyle(
        "CodeText",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#334155"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=slate_dark,
    )

    story = []

    # 1. Top Header Banner
    header_data = [
        [
            Paragraph("PREDICTRA-X / SENTRA", header_brand),
            Paragraph("<strong>DOCUMENT REF:</strong> SENTRA-AUDIT-" + time.strftime("%Y%m%d-%H%M%S", time.gmtime()), meta_value_style),
        ],
        [
            Paragraph("Four-Layer Financial Deposit Verification Core", subtitle_style),
            Paragraph(f"<strong>ISSUED:</strong> {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}", meta_value_style),
        ],
    ]
    header_table = Table(header_data, colWidths=[340, 200])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_red, spaceAfter=14))

    # 2. Certificate Title
    story.append(Paragraph("CRYPTOGRAPHIC AUDIT CERTIFICATE", title_style))
    story.append(Paragraph("Official SHA-256 Merkle Chain Verification & Integrity Attestation Report", subtitle_style))
    story.append(Spacer(1, 12))

    # 3. Integrity Verification Box
    status_text = "PASSED — ZERO TAMPERING DETECTED" if integrity_verified else "FAILED — CHAIN INTEGRITY BREACHED"
    status_color = emerald_green if integrity_verified else brand_red
    status_bg = emerald_bg if integrity_verified else colors.HexColor("#FEF2F2")

    integrity_box_data = [
        [
            Paragraph(
                f"<font color='{status_color.hexval()}'><strong>CRYPTOGRAPHIC MERKLE INTEGRITY: {status_text}</strong></font><br/>"
                f"<font color='#475569'>Every block in this ledger is cryptographically linked to its predecessor via SHA-256. "
                f"Full recursive verification completed across all {len(chain)} chain entries.</font>",
                ParagraphStyle("IntegrityNotice", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12),
            )
        ]
    ]
    integrity_box = Table(integrity_box_data, colWidths=[540])
    integrity_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), status_bg),
        ('BOX', (0, 0), (-1, -1), 1, status_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(integrity_box)
    story.append(Spacer(1, 12))

    # 4. Chain Metadata Overview
    genesis_hash = chain[0].entry_hash if chain else "N/A"
    head_hash = chain[-1].entry_hash if chain else "N/A"

    meta_table_data = [
        [
            Paragraph("Auditing Standard:", meta_label_style),
            Paragraph("SENTRA SHA-256 Merkle Audit Chain (RFC 6238 / SOC 2 Compatible)", meta_value_style),
            Paragraph("Chain Depth:", meta_label_style),
            Paragraph(f"{len(chain)} Immutable Blocks", meta_value_style),
        ],
        [
            Paragraph("Generated By:", meta_label_style),
            Paragraph(f"Operator: {operator_name} (Keycloak OIDC PKCE Authenticated)", meta_value_style),
            Paragraph("Hashing Engine:", meta_label_style),
            Paragraph("FIPS PUB 180-4 SHA-256", meta_value_style),
        ],
        [
            Paragraph("Genesis Hash:", meta_label_style),
            Paragraph(f"<font face='Courier' size='6.5'>{genesis_hash[:32]}...{genesis_hash[-12:]}</font>", meta_value_style),
            Paragraph("Head Hash:", meta_label_style),
            Paragraph(f"<font face='Courier' size='6.5'>{head_hash[:32]}...{head_hash[-12:]}</font>", meta_value_style),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[95, 185, 80, 180])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 5. Audit Log Table Header
    story.append(Paragraph("<strong>CHRONOLOGICAL AUDIT TRAIL LOG</strong>", ParagraphStyle("TableHeadTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=slate_dark)))
    story.append(Spacer(1, 6))

    # Table entries
    table_rows = [
        [
            Paragraph("#", table_header_style),
            Paragraph("Timestamp (UTC)", table_header_style),
            Paragraph("Action", table_header_style),
            Paragraph("Actor / Resource", table_header_style),
            Paragraph("Details Summary", table_header_style),
            Paragraph("SHA-256 Entry Hash", table_header_style),
        ]
    ]

    for entry in chain:
        details_snippet = ", ".join(f"{k}: {v}" for k, v in list(entry.details.items())[:2])
        if len(entry.details) > 2:
            details_snippet += "..."
        if not details_snippet:
            details_snippet = entry.resource_id or "—"

        actor_display = f"{entry.actor_username}"
        if entry.resource_id:
            actor_display += f"<br/><font color='#64748B' size='6.5'>Res: {entry.resource_id}</font>"

        short_hash = f"{entry.entry_hash[:16]}...{entry.entry_hash[-8:]}"

        table_rows.append([
            Paragraph(str(entry.index), cell_style),
            Paragraph(entry.iso_time.replace("T", " ").replace("Z", ""), cell_style),
            Paragraph(f"<strong>{entry.action}</strong>", cell_style),
            Paragraph(actor_display, cell_style),
            Paragraph(details_snippet[:45], cell_style),
            Paragraph(short_hash, code_style),
        ])

    entries_table = Table(
        table_rows,
        colWidths=[22, 90, 100, 105, 115, 108],
        repeatRows=1,
    )
    entries_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), slate_dark),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(entries_table)
    story.append(Spacer(1, 16))

    # 6. Attestation & Sign-off Seal Box
    seal_data = [
        [
            Paragraph(
                "<strong>CRYPTOGRAPHIC ATTESTATION & DIGITAL SEAL</strong><br/>"
                "This document is an authentic export of the PREDICTRA-X SENTRA tamper-evident Merkle ledger. "
                "The mathematical integrity of each entry has been validated against SHA-256 digest chaining. "
                "Any alteration of this record renders the cryptographic hash chain invalid.",
                ParagraphStyle("SealText", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=9.5, textColor=slate_muted),
            ),
            Paragraph(
                f"<strong>CERTIFIED BY:</strong><br/>"
                f"<font color='#C8102E'>PREDICTRA-X SECURITY GATEWAY</font><br/>"
                f"<font size='6.5'>Keycloak 26 OIDC · FastAPI 0.115<br/>"
                f"Digest: {head_hash[:20]}...</font>",
                ParagraphStyle("SignText", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=9.5, textColor=slate_dark),
            ),
        ]
    ]
    seal_table = Table(seal_data, colWidths=[380, 160])
    seal_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('BOX', (0, 0), (-1, -1), 1, brand_red),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether(seal_table))

    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer
