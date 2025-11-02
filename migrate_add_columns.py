#!/usr/bin/env python3
"""
Database migration script to add missing columns to CompanyDB table
Adds: postal_code, updated_at, vat_certificate_path
"""

import sqlite3
import os
from datetime import datetime

def migrate_database():
    db_path = os.path.join(os.path.dirname(__file__), '.dev.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("The database will be created on next server start.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if postal_code column exists
        cursor.execute("PRAGMA table_info(companies)")
        columns = [col[1] for col in cursor.fetchall()]

        migrations_applied = []

        # Add postal_code if it doesn't exist
        if 'postal_code' not in columns:
            print("Adding postal_code column...")
            cursor.execute("ALTER TABLE companies ADD COLUMN postal_code TEXT")
            migrations_applied.append("postal_code")
        else:
            print("postal_code column already exists")

        # Add updated_at if it doesn't exist
        if 'updated_at' not in columns:
            print("Adding updated_at column...")
            cursor.execute("ALTER TABLE companies ADD COLUMN updated_at TIMESTAMP")
            # Set default value for existing rows
            current_time = datetime.utcnow().isoformat()
            cursor.execute("UPDATE companies SET updated_at = ? WHERE updated_at IS NULL", (current_time,))
            migrations_applied.append("updated_at")
        else:
            print("updated_at column already exists")

        # Add vat_certificate_path if it doesn't exist
        if 'vat_certificate_path' not in columns:
            print("Adding vat_certificate_path column...")
            cursor.execute("ALTER TABLE companies ADD COLUMN vat_certificate_path TEXT")
            migrations_applied.append("vat_certificate_path")
        else:
            print("vat_certificate_path column already exists")

        conn.commit()

        if migrations_applied:
            print(f"\n✅ Migration successful! Added columns: {', '.join(migrations_applied)}")
        else:
            print("\n✅ No migrations needed. All columns already exist.")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
