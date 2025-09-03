import sqlite3
import json
import os
import shutil
from datetime import datetime
from contextlib import contextmanager
from typing import Dict, List, Optional, Any
import threading
from config import Config

class DatabaseManager:
    """Thread-safe SQLite database manager for the raffle system"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.DATABASE_PATH
        self.backup_path = Config.BACKUP_PATH
        self._local = threading.local()
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        os.makedirs(self.backup_path, exist_ok=True)
        
        # Initialize database
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Get a database connection with proper error handling"""
        if not hasattr(self._local, 'connection'):
            self._local.connection = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=30.0
            )
            self._local.connection.row_factory = sqlite3.Row
            
            # Enable WAL mode for better concurrent access
            self._local.connection.execute('PRAGMA journal_mode=WAL')
            self._local.connection.execute('PRAGMA foreign_keys=ON')
            
        try:
            yield self._local.connection
        except Exception as e:
            self._local.connection.rollback()
            raise e
    
    def init_database(self):
        """Initialize the database with all required tables"""
        with self.get_connection() as conn:
            # Users table for authentication
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'viewer',
                    name TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
            
            # Employees table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS employees (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    phone TEXT,
                    department TEXT,
                    position TEXT,
                    hire_date DATE,
                    photo_path TEXT,
                    total_entries INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Activities table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id INTEGER NOT NULL,
                    activity_name TEXT NOT NULL,
                    activity_category TEXT NOT NULL,
                    entries_awarded INTEGER NOT NULL,
                    awarded_by INTEGER,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
                    FOREIGN KEY (awarded_by) REFERENCES users (id)
                )
            ''')
            
            # Raffle history table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS raffle_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    winner_id INTEGER NOT NULL,
                    prize TEXT,
                    total_participants INTEGER,
                    total_entries INTEGER,
                    winning_chance REAL,
                    conducted_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (winner_id) REFERENCES employees (id),
                    FOREIGN KEY (conducted_by) REFERENCES users (id)
                )
            ''')
            
            # Audit log table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    table_name TEXT,
                    record_id INTEGER,
                    old_values TEXT,
                    new_values TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            # Settings table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes for performance
            conn.execute('CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_activities_employee ON activities(employee_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(created_at)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at)')
            
            # Create default admin user if none exists
            self._create_default_admin(conn)
            
            conn.commit()
    
    def _create_default_admin(self, conn):
        """Create default admin user if none exists"""
        import bcrypt
        
        # Check if any users exist
        cursor = conn.execute('SELECT COUNT(*) FROM users')
        if cursor.fetchone()[0] == 0:
            # Create default admin user
            password = 'Homeinstead3042'  # Should be changed immediately in production
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            conn.execute('''
                INSERT INTO users (email, password_hash, role, name)
                VALUES (?, ?, ?, ?)
            ''', ('homecare@homeinstead.com', password_hash, 'admin', 'Administrator'))
            
            print("Default admin user created: homecare@homeinstead.com / Homeinstead3042")
            print("IMPORTANT: Change this password immediately!")
    
    def migrate_from_json(self, json_file_path: str):
        """Migrate existing JSON data to SQLite database"""
        if not os.path.exists(json_file_path):
            return
        
        try:
            with open(json_file_path, 'r') as f:
                data = json.load(f)
            
            with self.get_connection() as conn:
                # Migrate employees
                if 'employees' in data:
                    for name, emp_data in data['employees'].items():
                        # Insert employee
                        cursor = conn.execute('''
                            INSERT OR IGNORE INTO employees 
                            (name, total_entries, created_at)
                            VALUES (?, ?, ?)
                        ''', (name, emp_data.get('entries', 0), 
                             emp_data.get('created_at', datetime.now().isoformat())))
                        
                        employee_id = cursor.lastrowid or conn.execute(
                            'SELECT id FROM employees WHERE name = ?', (name,)
                        ).fetchone()[0]
                        
                        # Insert activities
                        for activity in emp_data.get('activities', []):
                            conn.execute('''
                                INSERT INTO activities 
                                (employee_id, activity_name, activity_category, entries_awarded, created_at)
                                VALUES (?, ?, ?, ?, ?)
                            ''', (employee_id, activity['activity'], 'migrated', 
                                 activity['entries'], activity['date']))
                
                conn.commit()
                print(f"Successfully migrated data from {json_file_path}")
                
                # Backup original JSON file
                backup_name = f"{json_file_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(json_file_path, backup_name)
                print(f"Original JSON backed up to {backup_name}")
                
        except Exception as e:
            print(f"Error migrating JSON data: {e}")
    
    def backup_database(self) -> str:
        """Create a backup of the database"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(self.backup_path, f'raffle_backup_{timestamp}.db')
        
        try:
            shutil.copy2(self.db_path, backup_file)
            return backup_file
        except Exception as e:
            raise Exception(f"Failed to create backup: {e}")
    
    def log_audit(self, user_id: Optional[int], action: str, table_name: str = None, 
                  record_id: int = None, old_values: Dict = None, new_values: Dict = None,
                  ip_address: str = None, user_agent: str = None):
        """Log audit trail for security and compliance"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT INTO audit_log 
                (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, action, table_name, record_id,
                 json.dumps(old_values) if old_values else None,
                 json.dumps(new_values) if new_values else None,
                 ip_address, user_agent))
            conn.commit()

# Global database instance
db = DatabaseManager()