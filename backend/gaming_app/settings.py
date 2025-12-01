from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables (create a .env file in backend/ folder)
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY: Keep this secret! Use environment variable in production
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-#tj4@qox5@d0--!&c-*h4l5xl4d7iegzj+5dv1rdo*&p&7!&!&')

# SECURITY: Never expose debug in production
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

# SECURITY: Remove * and use your actual domain
ALLOWED_HOSTS = [
    'veltoragames.com',      # Replace with your actual domain
    'www.veltoragames.com',  # Replace with your actual domain
    '72.61.202.208',          # Replace with your VPS IP from Hostinger
    '127.0.0.1',
    'localhost',
]

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
    
    # Your gaming apps
    'accounts',
    'slots',
    'crash',
    'dragon',
    'fishing',
    'treasure',
    'miner',
    'space',
    'potion',
    'pyramid',
    'heist',
    'tower',
    'cards',
    'blackjack',
    'clicker',
    'colorswitch',
    'coinflip',
    'dice',
    'guessing',
    'minesweeper',
    'plinko',
    'wheel',
]

MIDDLEWARE = [
    # CORS must be first
    'corsheaders.middleware.CorsMiddleware',
    
    # Security middleware
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # For static files
    
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Custom user model
AUTH_USER_MODEL = 'accounts.User'

ROOT_URLCONF = 'gaming_app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # Add this if you have custom templates
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'gaming_app.wsgi.application'

# DATABASES: PostgreSQL for production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'gamingdb'),
        'USER': os.getenv('DB_USER', 'gaminguser'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'strong-password-here'),  # Set this in .env
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': 'prefer',  # Use SSL when possible
        },
    }
}

# CORS settings for production
CORS_ALLOW_CREDENTIALS = True

# SECURITY: Remove CORS_ALLOW_ALL_ORIGINS for production
CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    "https://veltoragames.com",      # Replace with your actual domain
    "https://www.veltoragames.com",  # Replace with your actual domain
    "http://localhost:3000",        # Keep for local dev
    "http://127.0.0.1:3000",        # Keep for local dev
]

# CSRF settings for production
CSRF_TRUSTED_ORIGINS = [
    "https://veltoragames.com",
    "https://www.veltoragames.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',  # If you're using token auth
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',  # More secure than AllowAny
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}

# Session settings for production
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = True  # Requires HTTPS

# CSRF settings for production
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True  # Requires HTTPS
CSRF_USE_SESSIONS = True

# SECURITY: Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,  # Enforce stronger passwords
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # Collectstatic will put files here
STATICFILES_DIRS = [
    BASE_DIR / 'static',  # If you have app-specific static files
]

# Media files (user uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# SECURITY HEADERS: Critical for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HTTPS settings (enable after SSL certificate)
SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Email settings (for password reset, etc.) - configure later
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'  # For testing
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'  # For production
# EMAIL_HOST = 'smtp.your-email-provider.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = os.getenv('EMAIL_USER')
# EMAIL_HOST_PASSWORD = os.getenv('EMAIL_PASSWORD')

# Logging for production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# Channels (for WebSockets) - configure if needed
ASGI_APPLICATION = 'gaming_app.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],
        },
    },
}