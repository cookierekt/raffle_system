import bcrypt
import jwt
import re
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, Optional, Tuple
from flask import request, jsonify, current_app
from database import db
from config import Config

class AuthManager:
    """Simplified authentication manager for Railway deployment"""
    
    @staticmethod
    def generate_token(user_data: Dict) -> str:
        """Generate JWT token"""
        payload = {
            'id': user_data['id'],
            'email': user_data['email'],
            'role': user_data['role'],
            'exp': datetime.utcnow() + timedelta(hours=5),  # 5 hour expiration
            'iat': datetime.utcnow()  # Issued at time
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET'], algorithm='HS256')
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """Verify JWT token and return user data"""
        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
            
            # Check if token is close to expiry (within 30 minutes) and log it
            exp_time = datetime.utcfromtimestamp(payload['exp'])
            time_until_exp = exp_time - datetime.utcnow()
            
            if time_until_exp.total_seconds() < 1800:  # Less than 30 minutes
                print(f"DEBUG: Token for {payload['email']} expires in {time_until_exp}")
            
            return {
                'id': payload['id'],
                'email': payload['email'], 
                'role': payload['role'],
                'exp': payload['exp']
            }
        except jwt.ExpiredSignatureError:
            print(f"DEBUG: Token expired for token: {token[:20]}...")
            return None
        except jwt.InvalidTokenError as e:
            print(f"DEBUG: Invalid token error: {e}")
            return None
    
    @staticmethod
    def login(email: str, password: str, ip_address: str = None) -> Tuple[bool, str, Optional[Dict]]:
        """Authenticate user credentials"""
        try:
            with db.get_connection() as conn:
                cursor = conn.execute(
                    'SELECT id, email, password_hash, role, name, is_active FROM users WHERE email = ?', 
                    (email,)
                )
                user = cursor.fetchone()
                
                if not user:
                    return False, "Invalid credentials", None
                
                if not user['is_active']:
                    return False, "Account is disabled", None
                
                # Check password
                if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                    user_data = {
                        'id': user['id'],
                        'email': user['email'],
                        'role': user['role'],
                        'name': user['name']
                    }
                    
                    # Log successful login
                    if ip_address:
                        db.log_audit(user['id'], "User login", ip_address=ip_address)
                    
                    return True, "Login successful", user_data
                else:
                    return False, "Invalid credentials", None
                    
        except Exception as e:
            print(f"Login error: {e}")
            return False, "Login error occurred", None

def login_required(f):
    """NO LOGIN REQUIRED - just pass through"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Fake user data
        request.current_user = {
            'user_id': 1,
            'role': 'admin',
            'email': 'admin@admin.com',
            'name': 'Administrator'
        }
        return f(*args, **kwargs)
    
    return decorated_function

def role_required(required_role: str):
    """NO ROLE CHECK - just pass through"""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            # Just pass through - no role checking
            return f(*args, **kwargs)
        return decorated_function
    return decorator