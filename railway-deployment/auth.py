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
            'exp': datetime.utcnow() + timedelta(hours=24)  # 24 hour expiration
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET'], algorithm='HS256')
    
    @staticmethod
    def verify_token(token: str) -> Optional[Dict]:
        """Verify JWT token and return user data"""
        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
            return {
                'id': payload['id'],
                'email': payload['email'], 
                'role': payload['role']
            }
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
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
    """Simplified login decorator using only Authorization headers"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        
        # Check Authorization header
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        if not token:
            return jsonify({'error': 'Authentication token required'}), 401
        
        # Verify token
        user_data = AuthManager.verify_token(token)
        if not user_data:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Add user data to request
        request.current_user = user_data
        return f(*args, **kwargs)
    
    return decorated_function

def role_required(required_role: str):
    """Role-based access control"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'error': 'User not authenticated'}), 401
            
            role_hierarchy = {'viewer': 1, 'manager': 2, 'admin': 3}
            user_level = role_hierarchy.get(request.current_user['role'], 0)
            required_level = role_hierarchy.get(required_role, 999)
            
            if user_level < required_level:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator