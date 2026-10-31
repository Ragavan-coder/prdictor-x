"""
PREDICTRA-X Database Engine & Session Management
Connects to PostgreSQL (predictra_x) with connection pooling and schema initialization.
Includes fallback to SQLite for local development resilience.
"""
import os
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("predictra.database")

# Load PostgreSQL connection URI from environment
POSTGRES_USER = os.getenv("POSTGRES_USER", "keycloak")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "KeycloakPgSecurePass2026!")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB_PREDICTRA", "predictra_x")

DEFAULT_PG_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_PG_URL)

try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"connect_timeout": 3},
    )
    # Test connection
    with engine.connect() as conn:
        pass
    logger.info(f"Connected to Primary PostgreSQL: {DATABASE_URL}")
except Exception as pg_err:
    logger.warning(f"PostgreSQL connection failed ({pg_err}). Falling back to local SQLite.")
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), "predictra_local.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency for database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for background workers and scripts."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Initializes all database tables safely and seeds baseline FDR records if empty."""
    try:
        import models  # Register models with Base
        Base.metadata.create_all(bind=engine)
        logger.info("PREDICTRA-X database schema created successfully.")

        # Seed initial FDR records if empty
        with get_db_context() as db:
            from models import FDRRecordModel
            count = db.query(FDRRecordModel).count()
            if count == 0:
                logger.info("Seeding initial enterprise FDR records into database...")
                sample_fdrs = [
                    FDRRecordModel(
                        receipt_number="FDR-2026-9041-HDFC",
                        bank_name="HDFC Bank Limited",
                        branch_name="Fort Branch, Mumbai",
                        ifsc_code="HDFC0000060",
                        account_holder="Rajeshwar V. Sharma",
                        principal_amount=1500000.0,
                        interest_rate=7.40,
                        tenure_months=24,
                        tenure_display="24 Months",
                        compounding_frequency="Quarterly",
                        issue_date="2025-01-15",
                        maturity_date="2027-01-15",
                        maturity_amount=1734560.0,
                        currency="INR",
                        verification_status="VERIFIED_AUTHENTIC",
                        layer1_evidence="PASSED (Watermark, seal & microprint validated)",
                        layer2_calculations="PASSED (Compound interest formula matches maturity sum)",
                        layer3_bank_validation="PASSED (Bank branch & IFSC validated against RBI master registry)",
                        layer4_doubtful_digits="PASSED (Zero font-weight or kerning discrepancies detected)",
                    ),
                    FDRRecordModel(
                        receipt_number="FDR-2026-8812-SBI",
                        bank_name="State Bank of India",
                        branch_name="Parliament Street, New Delhi",
                        ifsc_code="SBIN0000691",
                        account_holder="Ananya Sengupta",
                        principal_amount=2500000.0,
                        interest_rate=7.25,
                        tenure_months=36,
                        tenure_display="36 Months",
                        compounding_frequency="Quarterly",
                        issue_date="2024-06-10",
                        maturity_date="2027-06-10",
                        maturity_amount=3102920.0,
                        currency="INR",
                        verification_status="VERIFIED_AUTHENTIC",
                        layer1_evidence="PASSED (Security fibres and fluorescent seal verified)",
                        layer2_calculations="PASSED (Quarterly compounding verified against RBI rule 41)",
                        layer3_bank_validation="PASSED (Valid SBI treasury issue node)",
                        layer4_doubtful_digits="PASSED (Pixel variance 0.02% - pristine)",
                    ),
                    FDRRecordModel(
                        receipt_number="FDR-2026-3190-PNB",
                        bank_name="Punjab National Bank",
                        branch_name="Sector 17, Chandigarh",
                        ifsc_code="PUNB0017000",
                        account_holder="Harpreet Singh",
                        principal_amount=750000.0,
                        interest_rate=6.90,
                        tenure_months=12,
                        tenure_display="12 Months",
                        compounding_frequency="Quarterly",
                        issue_date="2025-03-01",
                        maturity_date="2026-03-01",
                        maturity_amount=803400.0,
                        currency="INR",
                        verification_status="PENDING_REVIEW",
                        layer1_evidence="PASSED (Physical watermark detected)",
                        layer2_calculations="PASSED (Calculations align)",
                        layer3_bank_validation="FLAGGED (Branch code updated in recent merger)",
                        layer4_doubtful_digits="PASSED (Font metrics match PNB standard)",
                    ),
                    FDRRecordModel(
                        receipt_number="FDR-2026-4402-ICICI",
                        bank_name="ICICI Bank",
                        branch_name="Bandra Kurla Complex, Mumbai",
                        ifsc_code="ICIC0000004",
                        account_holder="Meera Nair",
                        principal_amount=5000000.0,
                        interest_rate=7.50,
                        tenure_months=18,
                        tenure_display="18 Months",
                        compounding_frequency="Quarterly",
                        issue_date="2025-08-20",
                        maturity_date="2027-02-20",
                        maturity_amount=5588300.0,
                        currency="INR",
                        verification_status="VERIFIED_AUTHENTIC",
                        layer1_evidence="PASSED (Digital cryptographic QR validated)",
                        layer2_calculations="PASSED (Compound interest calculation verified)",
                        layer3_bank_validation="PASSED (Valid ICICI core treasury)",
                        layer4_doubtful_digits="PASSED (Pristine typography)",
                    ),
                    FDRRecordModel(
                        receipt_number="FDR-2026-7721-AXIS",
                        bank_name="Axis Bank",
                        branch_name="MG Road, Bengaluru",
                        ifsc_code="UTIB0000010",
                        account_holder="Vikramaditya Rao",
                        principal_amount=1200000.0,
                        interest_rate=7.30,
                        tenure_months=12,
                        tenure_display="12 Months",
                        compounding_frequency="Quarterly",
                        issue_date="2025-11-05",
                        maturity_date="2026-11-05",
                        maturity_amount=1290320.0,
                        currency="INR",
                        verification_status="FLAGGED_ANOMALY",
                        layer1_evidence="FLAGGED (Border microprint shows blurring or scanner artifact)",
                        layer2_calculations="PASSED (Math aligns)",
                        layer3_bank_validation="PASSED (Valid branch)",
                        layer4_doubtful_digits="FLAGGED (Kerning variance detected on maturity date digits)",
                    ),
                ]
                for fdr in sample_fdrs:
                    db.add(fdr)
                logger.info(f"Seeded {len(sample_fdrs)} initial FDR records successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database schema: {e}")
        raise
