import bcrypt
import jwt
import re
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, Optional, Tuple
from flask import request, jsonify, session, current_app
from database import db
from config import Config

class AuthManager:
    """Secure authentication manager with JWT and session handling"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify a password against its hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, str]:
        """Validate password strength"""
        if len(password) < 8:
            return False, "Password must be at least 8 characters long"
        
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        
        if not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        
        if not re.search(r'\d', password):
            return False, "Password must contain at least one number"
        
        if not re.search(r'[!@#$%^&*(),.?\":{}|<>]', password):
            return False, "Password must contain at least one special character"
        
        return True, "Password is valid"
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    @staticmethod
    def generate_token(user_data: Dict) -> str:
        """Generate JWT token for user"""
        payload = {
            'user_id': user_data['id'],
            'email': user_data['email'],
            'role': user_data['role'],
            'exp': datetime.utcnow() + timedelta(seconds=Config.SESSION_TIMEOUT // 1000),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, Config.JWT_SECRET, algorithm='HS256')
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """Verify JWT token and return user data"""
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    @staticmethod
    def login(email: str, password: str, ip_address: str = None) -> Tuple[bool, str, Optional[Dict]]:
        """Authenticate user login"""
        if not email or not password:
            return False, "Email and password are required", None
        
        if not AuthManager.validate_email(email):
            return False, "Invalid email format", None
        
        with db.get_connection() as conn:
            # Get user data
            cursor = conn.execute('''
                SELECT id, email, password_hash, role, name, failed_login_attempts, 
                       locked_until, is_active
                FROM users WHERE email = ?
            ''', (email,))
            
            user = cursor.fetchone()
            
            if not user:
                # Log failed attempt
                db.log_audit(None, f"Failed login attempt for non-existent user: {email}", 
                           ip_address=ip_address)
                return False, "Invalid email or password", None
            
            # Check if account is locked
            if user['locked_until'] and datetime.fromisoformat(user['locked_until']) > datetime.now():
                return False, "Account is temporarily locked due to too many failed attempts", None
            
            # Check if account is active
            if not user['is_active']:
                return False, "Account is disabled", None
            
            # Verify password
            if not AuthManager.verify_password(password, user['password_hash']):
                # Increment failed login attempts
                failed_attempts = user['failed_login_attempts'] + 1
                locked_until = None
                
                if failed_attempts >= Config.MAX_LOGIN_ATTEMPTS:
                    locked_until = (datetime.now() + timedelta(milliseconds=Config.LOCKOUT_TIME)).isoformat()
                
                conn.execute('''
                    UPDATE users 
                    SET failed_login_attempts = ?, locked_until = ?
                    WHERE id = ?
                ''', (failed_attempts, locked_until, user['id']))
                conn.commit()
                
                # Log failed attempt
                db.log_audit(user['id'], "Failed login attempt", ip_address=ip_address)
                
                return False, "Invalid email or password", None
            
            # Successful login - reset failed attempts and update last login
            conn.execute('''
                UPDATE users 
                SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (user['id'],))
            conn.commit()
            
            # Log successful login
            db.log_audit(user['id'], "Successful login", ip_address=ip_address)
            
            user_data = {
                'id': user['id'],
                'email': user['email'],
                'role': user['role'],
                'name': user['name']
            }
            
            return True, "Login successful", user_data
    
    @staticmethod
    def create_user(email: str, password: str, name: str, role: str = 'viewer', 
                   created_by: int = None) -> Tuple[bool, str]:
        """Create a new user account"""
        # Validate input
        if not AuthManager.validate_email(email):
            return False, "Invalid email format"
        
        is_valid, message = AuthManager.validate_password(password)
        if not is_valid:
            return False, message
        
        if role not in ['admin', 'manager', 'viewer']:
            return False, "Invalid role"
        
        try:
            with db.get_connection() as conn:
                # Check if user already exists
                cursor = conn.execute('SELECT id FROM users WHERE email = ?', (email,))
                if cursor.fetchone():
                    return False, "User with this email already exists"
                
                # Hash password and create user
                password_hash = AuthManager.hash_password(password)
                
                cursor = conn.execute('''
                    INSERT INTO users (email, password_hash, role, name)
                    VALUES (?, ?, ?, ?)
                ''', (email, password_hash, role, name))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                # Log user creation
                db.log_audit(created_by, f"Created user account", "users", user_id,
                           new_values={'email': email, 'role': role, 'name': name})
                
                return True, "User created successfully"
                
        except Exception as e:
            return False, f"Error creating user: {str(e)}"
    
    @staticmethod
    def change_password(user_id: int, old_password: str, new_password: str) -> Tuple[bool, str]:
        """Change user password"""
        # Validate new password
        is_valid, message = AuthManager.validate_password(new_password)
        if not is_valid:
            return False, message
        
        try:
            with db.get_connection() as conn:
                # Get current password hash
                cursor = conn.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
                user = cursor.fetchone()
                
                if not user:
                    return False, "User not found"
                
                # Verify old password
                if not AuthManager.verify_password(old_password, user['password_hash']):
                    return False, "Current password is incorrect"
                
                # Update password
                new_password_hash = AuthManager.hash_password(new_password)
                conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', 
                           (new_password_hash, user_id))
                conn.commit()
                
                # Log password change
                db.log_audit(user_id, "Password changed")
                
                return True, "Password changed successfully"
                
        except Exception as e:
            return False, f"Error changing password: {str(e)}"

def login_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid authorization header format'}), 401
        
        # Check for token in session (fallback)
        elif 'access_token' in session:
            token = session['access_token']
        
        if not token:
            return jsonify({'error': 'Authentication token is missing'}), 401
        
        # Verify token
        user_data = AuthManager.verify_token(token)
        if not user_data:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Add user data to request context
        request.current_user = user_data
        return f(*args, **kwargs)
    
    return decorated_function

def role_required(required_role: str):
    """Decorator to require specific role"""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            user_role = request.current_user['role']
            
            # Define role hierarchy
            role_hierarchy = {'viewer': 1, 'manager': 2, 'admin': 3}
            
            if role_hierarchy.get(user_role, 0) < role_hierarchy.get(required_role, 0):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator