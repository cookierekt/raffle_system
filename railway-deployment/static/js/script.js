class SimpleDashboard {
    constructor() {
        console.log('SimpleDashboard constructor called');
        this.employees = [];
        this.currentEmployeeId = null;
        this.init();
    }

    init() {
        console.log('SimpleDashboard init called');
        // Check authentication
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = '/login';
            return;
        }
        console.log('Token found, binding events and loading employees');
        
        try {
            this.bindEvents();
            this.loadEmployees();
        } catch (error) {
            console.error('Error in init:', error);
        }
    }

    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    bindEvents() {
        console.log('Binding events...');
        
        // Add employee
        const addBtn = document.getElementById('add-employee-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                console.log('Add employee button clicked');
                this.addEmployee();
            });
            console.log('Add employee button bound');
        }
        
        // Import Excel
        const importBtn = document.getElementById('import-excel-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                console.log('Import excel button clicked');
                this.openExcelModal();
            });
            console.log('Import excel button bound');
        }
        
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                console.log('Upload button clicked');
                this.uploadExcel();
            });
        }
        
        // Employee actions (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-entry-btn')) {
                console.log('Add entry button clicked');
                const employeeId = e.target.getAttribute('data-employee-id');
                const employeeName = e.target.getAttribute('data-employee-name');
                this.openAddEntryModal(employeeName, employeeId);
            } else if (e.target.classList.contains('clear-points-btn')) {
                console.log('Clear points button clicked');
                const employeeId = e.target.getAttribute('data-employee-id');
                const employeeName = e.target.getAttribute('data-employee-name');
                this.resetPoints(employeeId, employeeName);
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Logout button clicked');
                this.logout();
            });
            console.log('Logout button bound');
        }
        
        console.log('All events bound successfully');
    }

    async loadEmployees() {
        console.log('Loading employees...');
        try {
            const response = await fetch('/api/employees', {
                headers: this.getAuthHeaders()
            });

            if (response.status === 401) {
                console.log('401 error, logging out');
                this.logout();
                return;
            }

            const data = await response.json();
            console.log('Employees loaded:', data);
            
            if (data.success && data.employees) {
                this.employees = data.employees;
                console.log(`Found ${this.employees.length} employees`);
                this.renderEmployees();
                this.updateStats();
            } else {
                console.log('No employees or unsuccessful response:', data);
            }
        } catch (error) {
            console.error('Failed to load employees:', error);
            this.showAlert('Failed to load employees', 'error');
        }
    }

    renderEmployees() {
        console.log('Rendering employees...');
        const container = document.getElementById('employees-grid');
        if (!container) {
            console.log('No employees-grid container found');
            return;
        }

        if (this.employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Employees Yet</h3>
                    <p>Add your first employee to start tracking raffle entries!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.employees.map(employee => `
            <div class="employee-card">
                <div class="employee-header">
                    <div class="employee-info">
                        <div class="employee-name">${this.escapeHtml(employee.name)}</div>
                        <div class="employee-department">${employee.department || 'No Department'}</div>
                    </div>
                    <div class="employee-entries">${employee.total_entries || 0}</div>
                </div>
                <div class="employee-actions">
                    <button class="action-btn action-btn-primary add-entry-btn" 
                            data-employee-id="${employee.id}" 
                            data-employee-name="${this.escapeHtml(employee.name)}">
                        Add Entry
                    </button>
                    <button class="action-btn action-btn-warning clear-points-btn" 
                            data-employee-id="${employee.id}" 
                            data-employee-name="${this.escapeHtml(employee.name)}">
                        Clear Points
                    </button>
                </div>
            </div>
        `).join('');
        
        console.log(`Rendered ${this.employees.length} employee cards`);
    }

    async addEmployee() {
        console.log('Add employee called');
        const nameInput = document.getElementById('employee-name');
        const name = nameInput?.value?.trim();
        
        if (!name) {
            this.showAlert('Please enter an employee name', 'error');
            return;
        }

        try {
            const response = await fetch('/api/employee', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name: name })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Employee added successfully', 'success');
                nameInput.value = '';
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to add employee', 'error');
            }
        } catch (error) {
            console.error('Failed to add employee:', error);
            this.showAlert('Failed to add employee', 'error');
        }
    }

    openExcelModal() {
        console.log('Opening Excel modal');
        // Simple implementation - just trigger file input
        const fileInput = document.getElementById('excel-file');
        if (fileInput) {
            fileInput.click();
        } else {
            this.showAlert('Excel import not available', 'error');
        }
    }

    async uploadExcel() {
        console.log('Upload excel called');
        const fileInput = document.getElementById('excel-file');
        if (!fileInput || !fileInput.files[0]) {
            this.showAlert('Please select a file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const response = await fetch('/api/import_excel', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                this.showAlert(`Import successful! Added ${data.employees_added} employees.`, 'success');
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Import failed', 'error');
            }
        } catch (error) {
            console.error('Failed to upload Excel:', error);
            this.showAlert('Failed to upload Excel file', 'error');
        }
    }

    openAddEntryModal(employeeName, employeeId) {
        console.log(`Opening add entry modal for ${employeeName} (${employeeId})`);
        this.currentEmployeeId = employeeId;
        // Simple implementation - use prompt for now
        const activity = prompt(`Enter activity name for ${employeeName}:`);
        const entries = prompt('Number of entries to award (1-10):', '1');
        
        if (activity && entries) {
            this.addEntry(parseInt(entries), activity);
        }
    }

    async addEntry(entries, activityName) {
        if (!this.currentEmployeeId) return;
        
        try {
            const response = await fetch(`/api/employee/${this.currentEmployeeId}/add_entry`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    activity_name: activityName,
                    entries_awarded: entries
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Entry added successfully', 'success');
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to add entry', 'error');
            }
        } catch (error) {
            console.error('Failed to add entry:', error);
            this.showAlert('Failed to add entry', 'error');
        }
    }

    async resetPoints(employeeId, employeeName) {
        console.log(`Resetting points for ${employeeName} (${employeeId})`);
        if (!confirm(`Reset all points for ${employeeName}?`)) return;

        try {
            const response = await fetch(`/api/employee/${employeeId}/reset_points`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Points reset successfully', 'success');
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to reset points', 'error');
            }
        } catch (error) {
            console.error('Failed to reset points:', error);
            this.showAlert('Failed to reset points', 'error');
        }
    }

    updateStats() {
        console.log('Updating stats...');
        const totalEmployees = this.employees.length;
        const totalEntries = this.employees.reduce((sum, emp) => sum + (emp.total_entries || 0), 0);
        
        // Update stats display
        const statsElements = {
            'total-employees': totalEmployees,
            'total-entries': totalEntries,
            'active-employees': this.employees.filter(emp => (emp.total_entries || 0) > 0).length
        };
        
        for (const [id, value] of Object.entries(statsElements)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        }
    }

    logout() {
        console.log('Logging out...');
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }

    showAlert(message, type = 'info') {
        console.log(`Alert (${type}): ${message}`);
        alert(message); // Simple implementation
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating SimpleDashboard...');
    try {
        window.dashboard = new SimpleDashboard();
        console.log('SimpleDashboard created successfully');
    } catch (error) {
        console.error('Error creating SimpleDashboard:', error);
    }
});