"""WSGI entry point (used by gunicorn, Render, Docker and Vercel)."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

if os.getenv("VERCEL"):
    # Vercel functions start from a clean, read-only file system: run the
    # SQLite migrations into /tmp on cold start so the API is usable.
    from django.core.management import call_command

    call_command("migrate", interactive=False, verbosity=0)

# Vercel's Python runtime looks for a variable named `app`.
app = application
