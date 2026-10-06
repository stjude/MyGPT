#!/usr/bin/env python
"""
Desktop entrypoint for MyGPT Backend.
Runs Django with automatic database setup, migrations, and built-in WSGI/runserver
lifecycle management for Electron integration.
"""
import os
import sys
import argparse
import logging
import signal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('mygpt.desktop_server')

# Set settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_app.settings')

def handle_exit(signum, frame):
    logger.info("Received termination signal (%s). Shutting down MyGPT backend cleanly...", signum)
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    parser = argparse.ArgumentParser(description="MyGPT Desktop Backend Server")
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind server to')
    parser.add_argument('--port', type=int, default=8000, help='Port to run server on')
    parser.add_argument('--no-migrate', action='store_true', help='Skip running database migrations')
    args = parser.parse_args()

    # Ensure BASE_DIR is in sys.path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)

    try:
        import django
        from django.core.management import call_command
        django.setup()
        logger.info("Django %s initialized successfully.", django.get_version())

        if not args.no_migrate:
            logger.info("Applying database migrations...")
            call_command('migrate', interactive=False)
            logger.info("Database migrations up to date.")

        logger.info("Starting MyGPT API server on http://%s:%d ...", args.host, args.port)
        logger.info("Swagger documentation available at http://%s:%d/api/docs/", args.host, args.port)

        # Run WSGI server via execute_from_command_line
        from django.core.management import execute_from_command_line
        addrport = f"{args.host}:{args.port}"
        execute_from_command_line(['manage.py', 'runserver', addrport, '--noreload'])

    except Exception as exc:
        logger.exception("Failed to start MyGPT desktop backend server: %s", exc)
        sys.exit(1)

if __name__ == '__main__':
    main()
