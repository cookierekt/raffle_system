#!/usr/bin/env python3
"""
Initialize production database for Railway deployment
"""
import os
import sqlite3
import bcrypt
from database import DatabaseManager

def init_production_database():
    """Initialize database for production deployment"""
    print("Initializing production database...")
    
    # Create database manager
    db = DatabaseManager()
    
    # Initialize tables
    db.init_database()
    
    # Create admin user with production credentials
    admin_email = 'homecare@homeinstead.com'
    admin_password = 'Homeinstead3042'
    password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    with db.get_connection() as conn:
        # Remove any existing admin users
        conn.execute("DELETE FROM users WHERE role = 'admin'")
        
        # Create new admin user
        conn.execute('''
            INSERT INTO users (email, password_hash, role, name, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (admin_email, password_hash, 'admin', 'Administrator', 1))
        
        conn.commit()
        
        # Verify admin user was created
        cursor = conn.execute("SELECT email, role FROM users WHERE role = 'admin'")
        admin = cursor.fetchone()
        
        if admin:
            print(f"✓ Admin user created: {admin['email']}")
        else:
            print("✗ Failed to create admin user")
            return False
    
    print("✓ Production database initialized successfully!")
    return True

if __name__ == "__main__":
    if init_production_database():
        print("\nDatabase ready for deployment!")
    else:
        print("\nDatabase initialization failed!")
        exit(1)