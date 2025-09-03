import os
import secrets
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration class with security defaults"""
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY') or secrets.token_hex(32)
    JWT_SECRET = os.getenv('JWT_SECRET') or secrets.token_hex(32)
    
    # Database
    DATABASE_PATH = os.getenv('DATABASE_PATH', './data/raffle_database.db')
    BACKUP_PATH = os.getenv('BACKUP_PATH', './backups')
    
    # Application
    APP_NAME = os.getenv('APP_NAME', 'Home Instead Raffle Dashboard')
    COMPANY_NAME = os.getenv('COMPANY_NAME', 'Home Instead Senior Care')
    
    # File Upload
    MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', 5242880))  # 5MB default
    UPLOAD_PATH = os.getenv('UPLOAD_PATH', './uploads')
    ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'gif'}
    
    # Security Settings
    SESSION_TIMEOUT = int(os.getenv('SESSION_TIMEOUT', 3600000))  # 1 hour
    MAX_LOGIN_ATTEMPTS = int(os.getenv('MAX_LOGIN_ATTEMPTS', 5))
    LOCKOUT_TIME = int(os.getenv('LOCKOUT_TIME', 900000))  # 15 minutes
    
    # Email Configuration
    MAIL_SERVER = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USERNAME = os.getenv('SMTP_USER')
    MAIL_PASSWORD = os.getenv('SMTP_PASS')
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    
    # Feature Flags
    ENABLE_EMAIL_NOTIFICATIONS = os.getenv('ENABLE_EMAIL_NOTIFICATIONS', 'false').lower() == 'true'
    ENABLE_PHOTO_UPLOADS = os.getenv('ENABLE_PHOTO_UPLOADS', 'true').lower() == 'true'
    ENABLE_EXCEL_IMPORT = os.getenv('ENABLE_EXCEL_IMPORT', 'true').lower() == 'true'
    ENABLE_PDF_EXPORT = os.getenv('ENABLE_PDF_EXPORT', 'true').lower() == 'true'
    
    # Security Headers
    SECURITY_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;",
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    
class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Override with more secure settings for production
    SESSION_TIMEOUT = 1800000  # 30 minutes in production
    MAX_LOGIN_ATTEMPTS = 3     # Stricter in production
    
class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DATABASE_PATH = ':memory:'
    SECRET_KEY = 'testing-secret-key'
    JWT_SECRET = 'testing-jwt-secret'

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}