from pathlib import Path
import os
BASE_DIR = Path(__file__).resolve().parent.parent
from dotenv import load_dotenv
load_dotenv()
SECRET_KEY = 'django-insecure-#tj4@qox5@d0--!&c-*h4l5xl4d7iegzj+5dv1rdo*&p&7!&!&'

DEBUG = True

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'rest_framework',
    'corsheaders',
    'accounts',
    'slots',
    'crash',
    'dragon',
    'fishing',
    'treasure',
    'potion',
    'pyramid',
    'heist',
    'tower',
    'cards',
    'colorswitch',
    'guessing',
    'minesweeper',
    'wheel',
    'core',
    'wallets',
    'fortune',
    'sa_conf',

]


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.IPTrackingMiddleware',
]

AUTH_USER_MODEL = 'accounts.User'

ROOT_URLCONF = 'gaming_app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY")

PAYSTACK_CALLBACK_URL = "https://veltoragames.com/payment/callback"

WSGI_APPLICATION = 'gaming_app.wsgi.application'

# Channels + Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}
CRASH_ENGINE_LOCK_TTL = int(os.getenv("CRASH_ENGINE_LOCK_TTL", "15"))  # seconds

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


def env_list(key, default=None):
    value = os.getenv(key)
    if not value:
        return default or []
    return [v.strip() for v in value.split(",")]


CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
        #'rest_framework.permissions.AllowAny',
    ]
}

LOGIN_URL = "/admin/admin_login/"
LOGIN_REDIRECT_URL = "/admin/"
LOGOUT_REDIRECT_URL = "/admin/admin_login/"


CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_HTTPONLY = True

CORS_ALLOW_ALL_ORIGINS = False

# CSRF settings
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS
CSRF_USE_SESSIONS = False

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = True

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = "static/"
# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email settings for password reset
# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # Or your email provider
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'veltoragaming@gmail.com'  # Your email address
EMAIL_HOST_PASSWORD = 'jgjz gqnb jzhn uzov'
DEFAULT_FROM_EMAIL = 'Veltora Games <noreply@veltoragames.com>'
DEFAULT_REPLY_TO_EMAIL = 'support@veltrogames.com'  # Add this line
SITE_URL = 'https://veltrogames.com'  # Add this line
SUPPORT_EMAIL = 'support@veltrogames.com'  # Add this line
SUPPORT_WHATSAPP = '+1 (825) 572-0351'  # Add this line
SERVER_EMAIL = 'server@veltoragames.com'

# Email subject prefix
EMAIL_SUBJECT_PREFIX = '[Veltora Games] '

# Password reset settings
PASSWORD_RESET_TIMEOUT = 3600  # 1 hour

# Frontend URLs
FRONTEND_URL = 'https://veltrogames.com'  # Your React app URL
PASSWORD_RESET_CONFIRM_URL = f'{FRONTEND_URL}/password-reset-confirm'