"""Run the whole TYM stack locally with one command.

    python run.py            set up anything missing, migrate, seed, start API + website
    python run.py --reset    same, but wipe the local embedded database first

Settings: one .env at the project root, shared by backend and website (template: .env.example).
Database: uses DATABASE_URL from .env if set (e.g. docker compose or a real Postgres).
Otherwise starts an embedded PostgreSQL in .pgdata/ (no install needed).
"""
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
PY = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = "npm.cmd" if os.name == "nt" else "npm"
PGDATA = ROOT / ".pgdata"
PORTS = {5000: "API", 5173: "website"}


def step(msg):
    print(f"\n==> {msg}", flush=True)


def sh(*args, cwd=ROOT, env=None):
    subprocess.run([str(a) for a in args], cwd=cwd, env=env, check=True)


def port_in_use(port):
    # Vite listens on ::1 on Windows, Flask on 127.0.0.1, so check both.
    for family, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        with socket.socket(family) as s:
            if s.connect_ex((host, port)) == 0:
                return True
    return False


def stop(proc):
    """Stop a process and everything it started. Flask's reloader and Vite run as child
    processes; on Windows terminate() only kills the parent and the children keep the ports."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.terminate()


def stale(target: Path, *sources: Path) -> bool:
    """True if target is missing or older than any source."""
    return not target.exists() or any(s.stat().st_mtime > target.stat().st_mtime for s in sources)


def setup_backend():
    if not PY.exists():
        step("Creating Python virtualenv")
        sh(sys.executable, "-m", "venv", VENV)
    marker = VENV / ".installed"
    if stale(marker, BACKEND / "requirements.txt", BACKEND / "requirements-dev.txt"):
        step("Installing backend dependencies")
        sh(PY, "-m", "pip", "install", "-q", "-r", BACKEND / "requirements-dev.txt")
        marker.touch()


def setup_frontend():
    marker = FRONTEND / "node_modules" / ".package-lock.json"
    if stale(marker, FRONTEND / "package.json"):
        step("Installing frontend dependencies")
        sh(NPM, "install", "--no-fund", "--no-audit", cwd=FRONTEND)


def database_url():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf8").splitlines():
            if line.startswith("DATABASE_URL=") and line.split("=", 1)[1].strip():
                step("Using DATABASE_URL from .env")
                return line.split("=", 1)[1].strip(), None

    step("Starting embedded PostgreSQL (.pgdata/)")
    result = start_embedded()
    if result.returncode != 0 and PGDATA.exists():
        # Usually a server left half-running by an earlier crash. Stop it and try once more.
        step("Embedded PostgreSQL did not start cleanly, restarting it")
        pg_ctl("stop", "-m", "immediate")
        result = start_embedded()
    if result.returncode != 0:
        step("Rebuilding the local demo database")
        reset_embedded()
        result = start_embedded()
    if result.returncode != 0:
        sys.exit("Could not start the embedded PostgreSQL:\n" + result.stderr[-2000:])
    uri = result.stdout.strip().splitlines()[-1]
    return uri.replace("postgresql://", "postgresql+psycopg://", 1), "embedded"


# Ctrl+C in this terminal should not reach Postgres directly; run.py stops it cleanly on exit.
NEW_GROUP = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0


def start_embedded():
    """Start (or create) the embedded server and the 'tym' database. Returns the CompletedProcess."""
    conf = PGDATA / "postgresql.conf"
    if conf.exists() and "fsync = off" not in conf.read_text():
        # Demo data only. With fsync off Postgres also skips the start-up sync it runs after an
        # unclean stop, which on Windows fails on the server's own open log file (sharing violation).
        with conf.open("a") as f:
            f.write("\n# Added by run.py: local demo database only, never use in production\nfsync = off\n")
    # pgserver lives in the backend venv, so ask that interpreter to start it and report the URI.
    code = (
        "import pgserver, psycopg;"
        f"s = pgserver.get_server(r'{PGDATA}', cleanup_mode=None);"
        "c = psycopg.connect(s.get_uri(), autocommit=True);"
        "c.execute(\"SELECT 1 FROM pg_database WHERE datname='tym'\").fetchone() or c.execute('CREATE DATABASE tym');"
        "print(s.get_uri('tym'))"
    )
    return subprocess.run([str(PY), "-c", code], capture_output=True, text=True, creationflags=NEW_GROUP)


def pg_ctl(*args):
    """Run the embedded server's own pg_ctl (it ships inside the pgserver package)."""
    find = "import pgserver, pathlib; print(pathlib.Path(pgserver.__file__).parent / 'pginstall' / 'bin')"
    bindir = Path(subprocess.run([str(PY), "-c", find], capture_output=True, text=True, check=True).stdout.strip())
    return subprocess.run([str(bindir / "pg_ctl"), "-D", str(PGDATA), *args], capture_output=True, text=True)


def stop_embedded():
    code = f"import pgserver; pgserver.get_server(r'{PGDATA}', cleanup_mode='stop').cleanup()"
    subprocess.run([str(PY), "-c", code], capture_output=True)


def reset_embedded():
    """Delete the local demo database. Postgres must be stopped first or Windows keeps the files locked."""
    if PGDATA.exists():
        stop_embedded()
        pg_ctl("stop", "-m", "immediate")  # in case the clean stop could not reach it
        shutil.rmtree(PGDATA)


def main():
    busy = [f"{port} ({name})" for port, name in PORTS.items() if port_in_use(port)]
    if busy:
        ports = f"Ports {' and '.join(busy)} are" if len(busy) > 1 else f"Port {busy[0]} is"
        sys.exit(f"{ports} already in use, so TYM is probably still running in another terminal. "
                 "Press Ctrl+C there (or close that terminal) and run this again.")

    setup_backend()
    setup_frontend()

    if "--reset" in sys.argv:
        step("Removing local database")
        reset_embedded()

    url, mode = database_url()
    env = {**os.environ, "DATABASE_URL": url, "FLASK_APP": "wsgi.py", "PYTHONUNBUFFERED": "1"}
    step("Applying migrations")
    try:
        sh(PY, "-m", "flask", "db", "upgrade", cwd=BACKEND, env=env)
    except subprocess.CalledProcessError:
        if mode != "embedded":
            raise  # a real database: never wipe it automatically
        # The local demo database was built from an older migration history. It only holds
        # seed data, so rebuild it rather than fail.
        step("Local database is from an older schema, rebuilding it")
        reset_embedded()
        url, mode = database_url()
        env["DATABASE_URL"] = url
        sh(PY, "-m", "flask", "db", "upgrade", cwd=BACKEND, env=env)
    step("Seeding demo data")
    sh(PY, ROOT / "database" / "seed.py", cwd=BACKEND, env=env)

    step("Starting API on http://localhost:5000 and website on http://localhost:5173")
    procs = [
        subprocess.Popen([str(PY), "wsgi.py"], cwd=BACKEND, env=env),
        subprocess.Popen([NPM, "run", "dev"], cwd=FRONTEND),
    ]
    print("\nOpen http://localhost:5173   (Ctrl+C to stop everything)"
          "\nDemo log-in: aisha.k@example.com / tym-demo-2026\n", flush=True)
    try:
        while all(p.poll() is None for p in procs):
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        step("Shutting down")
        for p in procs:
            stop(p)
        if mode == "embedded":
            stop_embedded()


if __name__ == "__main__":
    main()
