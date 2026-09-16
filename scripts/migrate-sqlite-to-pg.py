"""Copy SQLite aca.db into the local PostgreSQL cluster (no Docker)."""
from __future__ import annotations

import csv
import os
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQLITE = ROOT / "apps" / "api" / "data" / "aca.db"
MARKER = ROOT / "apps" / "api" / "data" / ".sqlite-imported"
PORT = os.environ.get("ACA_PG_PORT", "5434")
DB = os.environ.get("ACA_PG_DATABASE", "aca")
USER = os.environ.get("ACA_PG_USER", "aca")

DATE_COLS = {
    "createdAt",
    "updatedAt",
    "triggeredAt",
    "nextRetryAt",
    "blockTime",
    "timestamp",
    "lastIngestAt",
    "finishedAt",
    "capturedAt",
}

BOOL_COLS = {
    "emailAlerts",
    "telegramAlerts",
    "active",
}


def pg_datetime(v) -> str:
    if v is None or v == "":
        return ""
    if isinstance(v, str) and not v.isdigit():
        return v
    try:
        n = int(v)
    except (TypeError, ValueError):
        return str(v)
    if n > 10_000_000_000:
        n = n / 1000.0
    return datetime.fromtimestamp(n, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+00"

ORDER = [
    "User",
    "UserSettings",
    "WatchlistItem",
    "AnalysisReport",
    "ChatSession",
    "ChatMessage",
    "PortfolioPosition",
    "PriceAlert",
    "AlertDelivery",
    "CopyFollow",
    "CopyPaperTrade",
    "TrackedWallet",
    "WalletTrade",
    "WalletNormalizedEvent",
    "TokenHolderSnapshot",
]


def find_psql() -> Path:
    env = os.environ.get("ACA_PG_BIN")
    names = ["psql.exe", "psql"]
    if env:
        for n in names:
            p = Path(env) / n
            if p.exists():
                return p
    for base in (
        Path(r"C:\Program Files\PostgreSQL"),
        Path(r"C:\Program Files (x86)\PostgreSQL"),
    ):
        if not base.exists():
            continue
        for v in ("18", "17", "16", "15", "14", "13"):
            for n in names:
                p = base / v / "bin" / n
                if p.exists():
                    return p
    return Path("psql")


def psql(psql_bin: Path, sql: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            str(psql_bin),
            "-h",
            "127.0.0.1",
            "-p",
            PORT,
            "-U",
            USER,
            "-d",
            DB,
            "-v",
            "ON_ERROR_STOP=1",
            "-tAc",
            sql,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> int:
    if MARKER.exists():
        print("[migrate] already imported")
        return 0
    if not SQLITE.exists():
        print("[migrate] no SQLite file — skip")
        MARKER.parent.mkdir(parents=True, exist_ok=True)
        MARKER.write_text("no-sqlite\n", encoding="utf-8")
        return 0

    psql_bin = find_psql()
    check = psql(psql_bin, 'SELECT COUNT(*) FROM "User";')
    if check.returncode != 0:
        print(check.stderr or check.stdout)
        print("[migrate] Postgres schema not ready (run prisma db push first)")
        return 1
    conn = sqlite3.connect(SQLITE)
    conn.row_factory = sqlite3.Row
    copied = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for table in ORDER:
            exists = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            ).fetchone()
            if not exists:
                continue
            dest = psql(psql_bin, f'SELECT COUNT(*) FROM "{table}";')
            if dest.returncode == 0:
                dest_n = int((dest.stdout or "0").splitlines()[-1].strip() or "0")
                if dest_n > 0:
                    print(f"[migrate] {table}: skip ({dest_n} already in Postgres)")
                    continue
            cols = [r[1] for r in conn.execute(f'PRAGMA table_info("{table}")').fetchall()]
            rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
            if not rows:
                continue
            csv_path = tmp_path / f"{table}.csv"
            with csv_path.open("w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh)
                for row in rows:
                    out = []
                    for col in cols:
                        v = row[col]
                        if v is None:
                            out.append("")
                        elif col in BOOL_COLS:
                            out.append("t" if v in (1, True, "1", "true", "t") else "f")
                        elif col in DATE_COLS:
                            out.append(pg_datetime(v))
                        elif isinstance(v, bytes):
                            out.append(v.decode("utf-8", "replace"))
                        else:
                            out.append(v)
                    w.writerow(out)
            col_list = ", ".join(f'"{c}"' for c in cols)
            copy_sql = (
                f"\\copy \"{table}\" ({col_list}) FROM '{csv_path.as_posix()}' "
                "CSV NULL ''"
            )
            r = subprocess.run(
                [
                    str(psql_bin),
                    "-h",
                    "127.0.0.1",
                    "-p",
                    PORT,
                    "-U",
                    USER,
                    "-d",
                    DB,
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-c",
                    copy_sql,
                ],
                capture_output=True,
                text=True,
            )
            if r.returncode != 0:
                print(r.stderr or r.stdout)
                print(f"[migrate] failed on {table}")
                return 1
            copied += len(rows)
            print(f"[migrate] {table}: {len(rows)} rows")

    MARKER.write_text(f"copied {copied} rows\n", encoding="utf-8")
    print(f"[migrate] done ({copied} rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
