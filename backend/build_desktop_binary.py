#!/usr/bin/env python3
"""
PyInstaller Packaging Script for MyGPT Backend.
Packages Django, ChromaDB, Sentence-Transformers, and dependencies into a standalone binary
distributable for Electron desktop integration.
"""
import os
import sys
import subprocess
import shutil

REQUIRED_MODULES = [
    ('django', 'Django'),
    ('rest_framework', 'djangorestframework'),
    ('drf_spectacular', 'drf-spectacular'),
    ('corsheaders', 'django-cors-headers'),
    ('chromadb', 'chromadb'),
    ('sentence_transformers', 'sentence-transformers'),
    ('ollama', 'ollama'),
]

def check_or_install_dependencies():
    """Verify that backend requirements are present in the current Python environment."""
    missing_pkgs = []
    for module_name, pip_name in REQUIRED_MODULES:
        try:
            __import__(module_name)
        except ImportError:
            missing_pkgs.append(pip_name)
    
    if missing_pkgs:
        print("\n[WARNING] The following required backend packages are missing in this Python environment:")
        for pkg in missing_pkgs:
            print(f"  • {pkg}")
        print("\nPyInstaller requires all Django apps and dependencies to be installed in the active environment.")
        print(f"To install them into this Python interpreter ({sys.executable}), run:")
        print(f"  {sys.executable} -m pip install -r requirements.txt pyinstaller\n")
        
        response = input("Would you like to install missing dependencies now? [y/N]: ").strip().lower()
        if response in ('y', 'yes'):
            req_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'requirements.txt')
            cmd = [sys.executable, "-m", "pip", "install", "-r", req_file, "pyinstaller"]
            print(f"Running: {' '.join(cmd)}")
            subprocess.check_call(cmd)
        else:
            print("[ABORTED] Please activate your virtual environment or install dependencies first.")
            sys.exit(1)

def build_binary():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, 'dist_desktop')
    build_dir = os.path.join(base_dir, 'build_desktop')
    
    print("==================================================")
    print(" MyGPT Backend Desktop Binary Builder (PyInstaller)")
    print("==================================================")
    print(f"Using Python: {sys.executable}")

    check_or_install_dependencies()

    # Check if pyinstaller is installed
    try:
        import PyInstaller
        print(f"Using PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("PyInstaller is not installed. Installing pyinstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # Hidden imports needed by Django and dynamic libraries
    hidden_imports = [
        'django.core.management',
        'django.contrib.admin.apps',
        'django.contrib.auth.apps',
        'django.contrib.contenttypes.apps',
        'django.contrib.sessions.apps',
        'django.contrib.messages.apps',
        'django.contrib.staticfiles.apps',
        'rest_framework',
        'rest_framework.authentication',
        'rest_framework.permissions',
        'rest_framework.parsers',
        'rest_framework.renderers',
        'rest_framework_simplejwt',
        'drf_spectacular',
        'drf_spectacular_sidecar',
        'corsheaders',
        'django_otp',
        'django_otp.plugins.otp_totp',
        'django_otp.plugins.otp_static',
        'testdb',
        'evaluation_dataset',
        'authentication',
        'chromadb',
        'duckdb',
        'sentence_transformers',
        'bm25s',
        'ollama',
    ]

    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=mygpt-backend",
        "--onedir",
        "--clean",
        "--noconfirm",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        os.path.join(base_dir, "desktop_entrypoint.py"),
    ]

    # Collect data for templates, static files, and models
    data_folders = [
        ("testdb/templates", "testdb/templates"),
        ("evaluation_dataset/templates", "evaluation_dataset/templates"),
    ]

    for src, dst in data_folders:
        src_path = os.path.join(base_dir, src)
        if os.path.exists(src_path):
            pyinstaller_cmd.append(f"--add-data={src_path}{os.pathsep}{dst}")

    for imp in hidden_imports:
        pyinstaller_cmd.append(f"--hidden-import={imp}")

    # Set PYTHONPATH
    env = os.environ.copy()
    existing_pythonpath = env.get('PYTHONPATH', '')
    env['PYTHONPATH'] = f"{base_dir}:{existing_pythonpath}" if existing_pythonpath else base_dir
    env['DJANGO_SETTINGS_MODULE'] = 'django_app.settings'

    print("\nRunning PyInstaller command...")
    try:
        subprocess.check_call(pyinstaller_cmd, cwd=base_dir, env=env)
        print("\n[SUCCESS] Standalone backend binary built successfully in:")
        print(f"  {os.path.join(dist_dir, 'mygpt-backend')}")
    except subprocess.CalledProcessError as err:
        print(f"\n[ERROR] PyInstaller build failed with exit code: {err.returncode}")
        sys.exit(err.returncode)

if __name__ == '__main__':
    build_binary()
