# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_entrypoint.py'],
    pathex=[],
    binaries=[],
    datas=[('testdb/templates', 'testdb/templates')],
    hiddenimports=['django.core.management', 'django.contrib.admin.apps', 'django.contrib.auth.apps', 'django.contrib.contenttypes.apps', 'django.contrib.sessions.apps', 'django.contrib.messages.apps', 'django.contrib.staticfiles.apps', 'rest_framework', 'rest_framework.authentication', 'rest_framework.permissions', 'rest_framework.parsers', 'rest_framework.renderers', 'rest_framework_simplejwt', 'drf_spectacular', 'drf_spectacular_sidecar', 'corsheaders', 'django_otp', 'django_otp.plugins.otp_totp', 'django_otp.plugins.otp_static', 'testdb', 'evaluation_dataset', 'authentication', 'chromadb', 'duckdb', 'sentence_transformers', 'bm25s', 'ollama'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='mygpt-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='mygpt-backend',
)
