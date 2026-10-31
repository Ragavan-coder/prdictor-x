"""
PREDICTRA-X Investigation Reports Package
"""
from reports.pdf_investigation_report import generate_fdr_investigation_pdf
from reports.excel_investigation_report import generate_fdr_investigation_excel

__all__ = ["generate_fdr_investigation_pdf", "generate_fdr_investigation_excel"]
