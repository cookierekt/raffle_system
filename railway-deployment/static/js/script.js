class SimpleDashboard {
    constructor() {
        this.employees = [];
        this.currentEmployeeId = null;
        this.init();
    }

    init() {
        // Check authentication
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        this.bindEvents();
        this.loadEmployees();
    }

    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    bindEvents() {
        // Add employee
        document.getElementById('add-employee-btn')?.addEventListener('click', () => this.addEmployee());
        
        // Import Excel
        document.getElementById('import-excel-btn')?.addEventListener('click', () => this.openExcelModal());
        document.getElementById('upload-btn')?.addEventListener('click', () => this.uploadExcel());
        
        // Employee actions (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-entry-btn')) {
                const employeeId = e.target.getAttribute('data-employee-id');
                const employeeName = e.target.getAttribute('data-employee-name');
                this.openAddEntryModal(employeeName, employeeId);
            } else if (e.target.classList.contains('clear-points-btn')) {
                const employeeId = e.target.getAttribute('data-employee-id');
                const employeeName = e.target.getAttribute('data-employee-name');
                this.resetPoints(employeeId, employeeName);
            }
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    }

    async loadEmployees() {
        try {
            const response = await fetch('/api/employees', {
                headers: this.getAuthHeaders()
            });

            if (response.status === 401) {
                this.logout();
                return;
            }

            const data = await response.json();
            
            if (data.success && data.employees) {
                this.employees = data.employees;
                this.renderEmployees();
                this.updateStats();
            }
        } catch (error) {
            console.error('Failed to load employees:', error);
            this.showAlert('Failed to load employees', 'error');
        }
    }

    renderEmployees() {
        const container = document.getElementById('employees-grid');
        if (!container) return;

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
    }

    async addEmployee() {
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
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (data.success) {
                nameInput.value = '';
                this.showAlert(data.message, 'success');
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to add employee', 'error');
            }
        } catch (error) {
            this.showAlert('Failed to add employee', 'error');
        }
    }

    openAddEntryModal(employeeName, employeeId) {
        this.currentEmployeeId = employeeId;
        const modal = document.getElementById('add-entry-modal');
        const employeeNameSpan = document.getElementById('modal-employee-name');
        
        if (modal && employeeNameSpan) {
            employeeNameSpan.textContent = employeeName;
            modal.style.display = 'block';
        }
    }

    async addEntry() {
        const activity = document.getElementById('activity-select')?.value;
        const entries = parseInt(document.getElementById('entries-input')?.value) || 1;

        if (!activity) {
            this.showAlert('Please select an activity', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/employee/${this.currentEmployeeId}/add_entry`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    activity_name: activity,
                    entries_awarded: entries
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message, 'success');
                this.closeAddEntryModal();
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to add entry', 'error');
            }
        } catch (error) {
            this.showAlert('Failed to add entry', 'error');
        }
    }

    async resetPoints(employeeId, employeeName) {
        if (!confirm(`Reset all points for ${employeeName}? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/employee/${employeeId}/reset_points`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message, 'success');
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to reset points', 'error');
            }
        } catch (error) {
            this.showAlert('Failed to reset points', 'error');
        }
    }

    openExcelModal() {
        const modal = document.getElementById('excel-import-modal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    async uploadExcel() {
        const fileInput = document.getElementById('excel-file');
        const file = fileInput?.files[0];

        if (!file) {
            this.showAlert('Please select a file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('/api/import_excel', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message, 'success');
                this.closeExcelModal();
                this.loadEmployees();
            } else {
                this.showAlert(data.error || 'Failed to import Excel', 'error');
            }
        } catch (error) {
            this.showAlert('Failed to import Excel', 'error');
        }
    }

    closeAddEntryModal() {
        const modal = document.getElementById('add-entry-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    closeExcelModal() {
        const modal = document.getElementById('excel-import-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    updateStats() {
        const totalEmployees = this.employees.length;
        const totalEntries = this.employees.reduce((sum, emp) => sum + (emp.total_entries || 0), 0);

        const totalEmployeesEl = document.getElementById('total-employees');
        const totalEntriesEl = document.getElementById('total-entries');

        if (totalEmployeesEl) totalEmployeesEl.textContent = totalEmployees;
        if (totalEntriesEl) totalEntriesEl.textContent = totalEntries;
    }

    showAlert(message, type = 'error') {
        // Simple alert for now
        alert(message);
    }

    logout() {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SimpleDashboard();
});