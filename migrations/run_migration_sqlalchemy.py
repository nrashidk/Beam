# run_migration_sqlalchemy.py
import os
from sqlalchemy import create_engine, text

# Load Neon connection URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("Please set DATABASE_URL environment variable.")

# Read migration SQL
with open("001_init_neon.sql", "r", encoding="utf-8") as f:
    sql = f.read()

# Create engine (no psycopg needed)
engine = create_engine(DATABASE_URL, echo=False)

print("Running migration with SQLAlchemy...")

with engine.connect() as conn:
    try:
        conn.execute(text(sql))
        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print("Migration failed. Rolled back.")
        raise
