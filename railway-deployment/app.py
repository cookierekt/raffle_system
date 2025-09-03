import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime
from werkzeug.utils import secure_filename
from openpyxl import load_workbook

from config import config
from database import db, DatabaseManager  
from auth_simple import AuthManager, login_required, role_required

# Create Flask app
app = Flask(__name__)
config_name = os.getenv('FLASK_ENV', 'production')
app.config.from_object(config[config_name])

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)
limiter.init_app(app)

# Create directories
os.makedirs('data', exist_ok=True)
os.makedirs('uploads', exist_ok=True)

# Initialize database
try:
    db_manager = DatabaseManager()
    db_manager.init_database()
    print("Database initialized successfully")
except Exception as e:
    print(f"Database initialization error: {e}")

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        success, message, user_data = AuthManager.login(
            email, password, get_remote_address()
        )
        
        if success:
            token = AuthManager.generate_token(user_data)
            return jsonify({
                'success': True,
                'message': message,
                'token': token,
                'user': user_data
            })
        else:
            return jsonify({'success': False, 'message': message}), 401
    
    return render_template('login.html')

@app.route('/api/employees', methods=['GET'])
@login_required
def get_employees():
    try:
        with db.get_connection() as conn:
            cursor = conn.execute('''
                SELECT id, name, email, phone, department, position, 
                       hire_date, photo_path, total_entries, is_active,
                       created_at, updated_at
                FROM employees WHERE is_active = 1
                ORDER BY name
            ''')
            
            employees = []
            for row in cursor.fetchall():
                employee = dict(row)
                employees.append(employee)
            
            return jsonify({
                'success': True,
                'employees': employees
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/employee', methods=['POST'])
@login_required
@role_required('manager')
def add_employee():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        with db.get_connection() as conn:
            cursor = conn.execute(
                'SELECT id FROM employees WHERE name = ? AND is_active = 1', 
                (name,)
            )
            if cursor.fetchone():
                return jsonify({'success': False, 'error': 'Employee already exists'}), 400
            
            conn.execute('''
                INSERT INTO employees (name, total_entries, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (name, 0, 1, datetime.now(), datetime.now()))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Employee "{name}" added successfully'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/employee/<int:employee_id>/add_entry', methods=['POST'])
@login_required
@role_required('manager')
def add_entry(employee_id):
    try:
        data = request.get_json()
        activity_name = data.get('activity_name', '').strip()
        entries_awarded = int(data.get('entries_awarded', 1))
        
        if not activity_name:
            return jsonify({'success': False, 'error': 'Activity name is required'}), 400
        
        if entries_awarded <= 0 or entries_awarded > 10:
            return jsonify({'success': False, 'error': 'Entries must be between 1 and 10'}), 400
        
        with db.get_connection() as conn:
            # Check if employee exists
            cursor = conn.execute('SELECT id, name, total_entries FROM employees WHERE id = ? AND is_active = 1', (employee_id,))
            employee = cursor.fetchone()
            
            if not employee:
                return jsonify({'success': False, 'error': 'Employee not found'}), 404
            
            # Add activity
            conn.execute('''
                INSERT INTO activities (employee_id, activity_name, activity_category, 
                                      entries_awarded, awarded_by)
                VALUES (?, ?, ?, ?, ?)
            ''', (employee_id, activity_name, 'manual', entries_awarded, request.current_user['id']))
            
            # Update employee total entries
            new_total = employee['total_entries'] + entries_awarded
            conn.execute('UPDATE employees SET total_entries = ?, updated_at = ? WHERE id = ?', 
                        (new_total, datetime.now(), employee_id))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Added {entries_awarded} entries for {employee["name"]}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/employee/<int:employee_id>/reset_points', methods=['POST'])
@login_required
@role_required('manager')
def reset_points(employee_id):
    try:
        with db.get_connection() as conn:
            cursor = conn.execute('SELECT name FROM employees WHERE id = ? AND is_active = 1', (employee_id,))
            employee = cursor.fetchone()
            
            if not employee:
                return jsonify({'success': False, 'error': 'Employee not found'}), 404
            
            # Reset points
            conn.execute('UPDATE employees SET total_entries = 0, updated_at = ? WHERE id = ?', 
                        (datetime.now(), employee_id))
            
            # Remove all activities for this employee
            conn.execute('DELETE FROM activities WHERE employee_id = ?', (employee_id,))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': f'Reset points for {employee["name"]}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/import_excel', methods=['POST'])
@login_required
@role_required('manager')
def import_excel():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({'success': False, 'error': 'Invalid file type. Please upload Excel files only.'}), 400
        
        # Process Excel file
        workbook = load_workbook(file)
        sheet = workbook.active
        
        employees_added = 0
        errors = []
        
        with db.get_connection() as conn:
            for row_num, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                if not row or not any(row):
                    continue
                
                # Try to find name in different columns
                name = None
                for cell in row[:5]:  # Check first 5 columns
                    if cell and isinstance(cell, str) and len(cell.strip()) > 2:
                        name = cell.strip()
                        break
                
                if not name:
                    continue
                
                try:
                    # Check if employee exists
                    cursor = conn.execute('SELECT id FROM employees WHERE name = ? AND is_active = 1', (name,))
                    if not cursor.fetchone():
                        # Add employee
                        conn.execute('''
                            INSERT INTO employees (name, total_entries, is_active, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?)
                        ''', (name, 0, 1, datetime.now(), datetime.now()))
                        employees_added += 1
                        
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
            
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Import completed. Added {employees_added} employees.',
            'employees_added': employees_added,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'Import failed: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)