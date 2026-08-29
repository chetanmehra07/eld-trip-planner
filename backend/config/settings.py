"""
Django settings for the ELD Trip Planner API.

Everything environment-specific is read from environment variables (see
backend/.env.example) so the same code base runs locally, in Docker and on
Render / Railway / Vercel.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# ---------------------------------------------------------------- core
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-insecure-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "*")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "trips",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------- database
# SQLite by default (zero setup). Set DATABASE_URL for Postgres in production.
# On Vercel the file system is read-only except /tmp.
_default_sqlite = f"sqlite:///{(Path('/tmp') if os.getenv('VERCEL') else BASE_DIR) / 'db.sqlite3'}"
DATABASES = {
    "default": dj_database_url.config(default=_default_sqlite, conn_max_age=600),
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------- i18n / time
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
# The planner works in "home terminal time" supplied by the client, so we keep
# naive datetimes end-to-end (the paper log says: "Use time standard of home terminal").
USE_TZ = False

# ---------------------------------------------------------------- static
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- CORS
_cors_origins = env_list("CORS_ALLOWED_ORIGINS")
if _cors_origins:
    CORS_ALLOWED_ORIGINS = _cors_origins
else:
    # Convenient default for local development / demo deployments.
    CORS_ALLOW_ALL_ORIGINS = True

# ---------------------------------------------------------------- DRF
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
}

# ---------------------------------------------------------------- cache
# Geocoding and routing responses are cached (LocMem by default, Redis if REDIS_URL is set).
if os.getenv("REDIS_URL"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.getenv("REDIS_URL"),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "eld-trip-planner",
        }
    }

# ---------------------------------------------------------------- planner
ROUTING_PROVIDER = os.getenv("ROUTING_PROVIDER", "osrm").lower()  # "osrm" (free, no key) or "ors"
OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")
ORS_API_KEY = os.getenv("ORS_API_KEY", "")
NOMINATIM_BASE_URL = os.getenv("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org")
PHOTON_BASE_URL = os.getenv("PHOTON_BASE_URL", "https://photon.komoot.io")
GEOCODER_USER_AGENT = os.getenv("GEOCODER_USER_AGENT", "eld-trip-planner/1.0 (fullstack assessment)")
# OSRM uses a passenger-car profile; trucks average less. The planner never
# assumes a higher average speed than this.
MAX_AVERAGE_SPEED_MPH = float(os.getenv("MAX_AVERAGE_SPEED_MPH", "60"))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}
