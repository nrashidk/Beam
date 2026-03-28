"""
Backup Engine — Task 29 (P2-E)
Provides run_backup() called by APScheduler daily and by the on-demand trigger endpoint.

Supports:
  - SQLite  : uses Python's built-in sqlite3 .iterdump() + gzip
  - PostgreSQL : shells out pg_dump | gzip

Environment variables
  BACKUP_DIR            Path to write dump files (default: ./backups)
  BACKUP_S3_BUCKET      If set, uploads the dump to this S3 bucket after writing locally
  BACKUP_S3_PREFIX      S3 key prefix (default: involinks-db-backups)
  DATABASE_URL          Standard DB URL (read from environment / app config)
"""
import gzip
import hashlib
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "./backups"))


def _sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _backup_sqlite(db_path: str, out_path: Path) -> None:
    """Dump a SQLite database using the built-in sqlite3 module."""
    import sqlite3

    conn = sqlite3.connect(db_path)
    with gzip.open(out_path, "wt", encoding="utf-8") as gz:
        for line in conn.iterdump():
            gz.write(line + "\n")
    conn.close()


def _backup_postgres(db_url: str, out_path: Path) -> None:
    """Shell out to pg_dump and pipe through gzip."""
    with gzip.open(out_path, "wb") as gz:
        result = subprocess.run(
            ["pg_dump", "--no-password", db_url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"pg_dump failed (exit {result.returncode}): "
                + result.stderr.decode("utf-8", errors="replace")[:500]
            )
        gz.write(result.stdout)


def _upload_to_s3(local_path: Path, filename: str) -> Optional[str]:
    """Upload to S3 if BACKUP_S3_BUCKET is configured. Returns the S3 URI or None."""
    bucket = os.getenv("BACKUP_S3_BUCKET", "")
    if not bucket:
        return None
    try:
        import boto3

        prefix = os.getenv("BACKUP_S3_PREFIX", "involinks-db-backups")
        key = f"{prefix}/{filename}"
        s3 = boto3.client("s3")
        s3.upload_file(str(local_path), bucket, key)
        uri = f"s3://{bucket}/{key}"
        logger.info(f"💾 Backup uploaded to {uri}")
        return uri
    except Exception as exc:
        logger.error(f"S3 upload failed: {exc}")
        return None


def run_backup(triggered_by: str = "scheduler") -> dict:
    """
    Execute one full backup cycle.

    Returns a dict with keys:
        success (bool), filename, file_size_bytes, checksum_sha256,
        storage_path, error_message, started_at, completed_at, triggered_by
    
    NOTE: Does NOT interact with the database — the caller is responsible for
    persisting the result to BackupLogDB to avoid circular imports.
    """
    db_url = os.getenv("DATABASE_URL", "sqlite:///./.dev.db")
    started_at = datetime.utcnow()
    ts = started_at.strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"involinks_db_{ts}.sql.gz"

    backup_dir = Path(os.getenv("BACKUP_DIR", "./backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    out_path = backup_dir / filename

    try:
        if "sqlite" in db_url.lower():
            sqlite_file = db_url.replace("sqlite:///", "").replace("sqlite://", "")
            sqlite_file = os.path.abspath(sqlite_file)
            logger.info(f"💾 Backup: SQLite dump → {out_path}")
            _backup_sqlite(sqlite_file, out_path)
        elif "postgresql" in db_url.lower() or "postgres" in db_url.lower():
            logger.info(f"💾 Backup: pg_dump → {out_path}")
            _backup_postgres(db_url, out_path)
        else:
            raise ValueError(f"Unsupported database URL scheme: {db_url[:30]}")

        file_size = out_path.stat().st_size
        checksum = _sha256_of_file(out_path)
        storage_path = str(out_path.resolve())

        s3_uri = _upload_to_s3(out_path, filename)
        if s3_uri:
            storage_path = s3_uri

        completed_at = datetime.utcnow()
        logger.info(
            f"✅ Backup complete: {filename} | "
            f"{file_size:,} bytes | SHA-256={checksum[:16]}… | "
            f"triggered_by={triggered_by}"
        )
        return {
            "success": True,
            "filename": filename,
            "file_size_bytes": file_size,
            "checksum_sha256": checksum,
            "storage_path": storage_path,
            "error_message": None,
            "started_at": started_at,
            "completed_at": completed_at,
            "triggered_by": triggered_by,
        }

    except Exception as exc:
        completed_at = datetime.utcnow()
        msg = str(exc)
        logger.error(f"❌ Backup FAILED (triggered_by={triggered_by}): {msg}")
        if out_path.exists():
            try:
                out_path.unlink()
            except OSError:
                pass
        return {
            "success": False,
            "filename": filename,
            "file_size_bytes": None,
            "checksum_sha256": None,
            "storage_path": None,
            "error_message": msg,
            "started_at": started_at,
            "completed_at": completed_at,
            "triggered_by": triggered_by,
        }
