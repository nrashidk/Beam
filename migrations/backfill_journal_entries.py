"""
backfill_journal_entries.py
===========================
One-time migration script that:
1. Creates default chart of accounts for all existing companies
2. Generates journal entries for all existing ISSUED/PAID invoices
3. Generates journal entries for all existing purchase (inward) invoices
4. Logs progress and skipped records

Run from project root:
    python migrations/backfill_journal_entries.py
"""

import os
import sys
import logging
from uuid import uuid4
from datetime import date, datetime

# Allow imports from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_gl")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)
Session = sessionmaker(bind=engine, future=True)


def run():
    from main import (
        CompanyDB,
        InvoiceDB,
        InwardInvoiceDB,
        InvoiceStatus,
        InvoiceType,
        AccountDB,
        JournalEntryDB,
        JournalEntryLineDB,
        create_default_chart_of_accounts,
        create_journal_entry_for_invoice,
        create_journal_entry_for_purchase,
        Base,
    )

    # Ensure GL tables exist
    Base.metadata.create_all(engine)

    db = Session()
    try:
        companies = db.query(CompanyDB).all()
        logger.info(f"Found {len(companies)} companies")

        # Step 1 — Create default chart of accounts for every company
        for company in companies:
            existing = db.query(AccountDB).filter(AccountDB.company_id == company.id).count()
            if existing == 0:
                create_default_chart_of_accounts(company.id, db)
                logger.info(f"  Created default accounts for company {company.id}")
            else:
                logger.info(f"  Company {company.id} already has {existing} accounts — skipping")

        db.commit()
        logger.info("Step 1 complete: chart of accounts ready for all companies")

        # Step 2 — Backfill journal entries for outgoing invoices (ISSUED or PAID)
        invoices = (
            db.query(InvoiceDB)
            .filter(InvoiceDB.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.SENT]))
            .all()
        )
        logger.info(f"Found {len(invoices)} issued/paid/sent invoices to backfill")

        created = 0
        skipped = 0
        for inv in invoices:
            # Skip if a journal entry already exists for this invoice
            existing_je = (
                db.query(JournalEntryDB)
                .filter(
                    JournalEntryDB.reference_id == inv.id,
                    JournalEntryDB.company_id == inv.company_id,
                    JournalEntryDB.reference_type.in_(["INVOICE", "CREDIT_NOTE"]),
                )
                .first()
            )
            if existing_je:
                skipped += 1
                continue
            try:
                create_journal_entry_for_invoice(inv, db)
                db.flush()
                created += 1
            except Exception as exc:
                logger.warning(f"  Skipped invoice {inv.invoice_number}: {exc}")
                skipped += 1

        db.commit()
        logger.info(f"Step 2 complete: {created} journal entries created, {skipped} skipped")

        # Step 3 — Backfill journal entries for purchase (inward) invoices
        purchases = db.query(InwardInvoiceDB).all()
        logger.info(f"Found {len(purchases)} purchase invoices to backfill")

        p_created = 0
        p_skipped = 0
        for purch in purchases:
            existing_je = (
                db.query(JournalEntryDB)
                .filter(
                    JournalEntryDB.reference_id == str(purch.id),
                    JournalEntryDB.company_id == purch.company_id,
                    JournalEntryDB.reference_type == "PURCHASE",
                )
                .first()
            )
            if existing_je:
                p_skipped += 1
                continue
            try:
                create_journal_entry_for_purchase(purch, db)
                db.flush()
                p_created += 1
            except Exception as exc:
                logger.warning(f"  Skipped purchase {getattr(purch, 'supplier_invoice_number', purch.id)}: {exc}")
                p_skipped += 1

        db.commit()
        logger.info(f"Step 3 complete: {p_created} purchase JEs created, {p_skipped} skipped")

        logger.info("Backfill complete.")

    except Exception as e:
        db.rollback()
        logger.error(f"Backfill failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
