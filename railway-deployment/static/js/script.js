class RaffleDashboard {
    constructor() {
        this.employees = [];
        this.currentEmployee = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadEmployees();
        this.updateDateInfo();
        this.initAnimations();
        this.updateStats();
    }

    bindEvents() {
        // Add employee form
        document.getElementById('add-employee-btn').addEventListener('click', () => this.addEmployee());
        document.getElementById('employee-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addEmployee();
        });

        // Search functionality (if exists)
        const searchEl = document.getElementById('employee-search');
        if (searchEl) {
            searchEl.addEventListener('input', (e) => this.filterEmployees(e.target.value));
        }
        
        // View toggle (if exists)
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleEmployeeView(e.target.dataset.view));
        });

        // Control buttons
        document.getElementById('start-raffle-btn').addEventListener('click', () => this.openRaffleModal());
        document.getElementById('import-excel-btn').addEventListener('click', () => this.openExcelImportModal());
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadEmployees());
        document.getElementById('analytics-btn').addEventListener('click', () => this.openAnalyticsModal());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetData());
        
        // Dropdown menu (if exists)
        const moreActionsBtn = document.getElementById('more-actions-btn');
        if (moreActionsBtn) {
            moreActionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => this.closeDropdown());
        }

        // Modal events - use more specific selector
        const addEntryCloseBtn = document.querySelector('#add-entry-modal .close');
        if (addEntryCloseBtn) {
            addEntryCloseBtn.addEventListener('click', () => this.closeModal());
        }
        document.getElementById('close-excel-modal').addEventListener('click', () => this.closeExcelModal());
        document.getElementById('close-raffle-modal').addEventListener('click', () => this.closeRaffleModal());
        document.getElementById('close-analytics-modal').addEventListener('click', () => this.closeAnalyticsModal());
        document.getElementById('add-entry-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('add-entry-modal')) {
                this.closeModal();
            }
        });
        document.getElementById('excel-import-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('excel-import-modal')) {
                this.closeExcelModal();
            }
        });
        document.getElementById('raffle-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('raffle-modal')) {
                this.closeRaffleModal();
            }
        });

        // Raffle events
        document.getElementById('spin-wheel-btn').addEventListener('click', () => this.spinWheel());
        document.getElementById('new-raffle-btn').addEventListener('click', () => this.resetRaffle());

        // Excel import events
        document.getElementById('browse-file-btn').addEventListener('click', () => {
            document.getElementById('excel-file').click();
        });
        document.getElementById('excel-file').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadExcelFile());

        // Drag and drop
        const uploadArea = document.getElementById('upload-area');
        uploadArea.addEventListener('click', () => document.getElementById('excel-file').click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Entry buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('entry-btn')) {
                const entries = parseInt(e.target.dataset.entries);
                const activity = e.target.dataset.activity;
                this.addEntryToEmployee(this.currentEmployee, activity, entries);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeExcelModal();
                this.closeRaffleModal();
            }
        });
    }

    openRaffleModal() {
        const eligibleEmployees = this.employees.filter(employee => employee.total_entries > 0);
        
        if (eligibleEmployees.length === 0) {
            this.showAlert('No employees with raffle entries found. Add some entries first!', 'error');
            return;
        }
        
        document.getElementById('raffle-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.setupRaffle(eligibleEmployees);
    }

    closeRaffleModal() {
        document.getElementById('raffle-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.resetRaffle();
    }

    setupRaffle(eligibleEmployees) {
        const totalEntries = eligibleEmployees.reduce((sum, employee) => sum + employee.total_entries, 0);
        
        // Update stats
        document.getElementById('raffle-participants').textContent = eligibleEmployees.length;
        document.getElementById('raffle-total-entries').textContent = totalEntries;
        
        // Create participants list
        const participantsGrid = document.getElementById('participants-grid');
        participantsGrid.innerHTML = eligibleEmployees.map(employee => {
            const chance = ((employee.total_entries / totalEntries) * 100).toFixed(1);
            return `
                <div class="participant-item">
                    <div class="participant-name">${this.escapeHtml(employee.name)}</div>
                    <div class="participant-entries">${employee.total_entries} entries</div>
                    <div class="participant-chance">${chance}% chance</div>
                </div>
            `;
        }).join('');
        
        // Reset wheel and controls
        document.getElementById('raffle-result').style.display = 'none';
        document.getElementById('spin-wheel-btn').style.display = 'block';
        document.getElementById('spin-wheel-btn').disabled = false;
        document.getElementById('spin-wheel-btn').innerHTML = 'Spin the Wheel!';
        
        // Reset wheel rotation
        const wheel = document.getElementById('raffle-wheel');
        wheel.classList.remove('wheel-spinning');
        wheel.style.transform = 'rotate(0deg)';
        
        this.raffleData = {
            participants: eligibleEmployees,
            totalEntries: totalEntries,
            isSpinning: false
        };
    }

    spinWheel() {
        if (this.raffleData.isSpinning) return;
        
        this.raffleData.isSpinning = true;
        const spinBtn = document.getElementById('spin-wheel-btn');
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<div class="loading"></div> Spinning...';
        
        // Select winner using weighted random selection
        const winner = this.selectWeightedWinner();
        
        // Calculate spin animation
        const baseSpins = 5; // Number of full rotations
        const randomSpin = Math.random() * 360; // Random final position
        const totalDegrees = (baseSpins * 360) + randomSpin;
        
        const wheel = document.getElementById('raffle-wheel');
        wheel.style.setProperty('--spin-degrees', `${totalDegrees}deg`);
        wheel.classList.add('wheel-spinning');
        
        // Show winner after spin completes
        setTimeout(() => {
            this.announceWinner(winner);
            this.raffleData.isSpinning = false;
        }, 4000);
        
        // Add suspense sound effect (visual feedback)
        this.addSpinEffects();
    }

    selectWeightedWinner() {
        const random = Math.random() * this.raffleData.totalEntries;
        let currentWeight = 0;
        
        for (const employee of this.raffleData.participants) {
            currentWeight += employee.total_entries;
            if (random <= currentWeight) {
                return { name: employee.name, data: { entries: employee.total_entries } };
            }
        }
        
        // Fallback (should never reach here)
        const fallbackEmployee = this.raffleData.participants[0];
        return { name: fallbackEmployee.name, data: { entries: fallbackEmployee.total_entries } };
    }

    announceWinner(winner) {
        document.getElementById('winner-name').textContent = winner.name;
        document.getElementById('winner-details').textContent = 
            `Won with ${winner.data.entries} raffle entries!`;
        
        document.getElementById('spin-wheel-btn').style.display = 'none';
        document.getElementById('raffle-result').style.display = 'block';
        
        // Confetti effect
        this.createConfetti();
        
        // Success sound effect (visual feedback)
        this.showAlert(`${winner.name} wins the raffle!`, 'success');
    }

    resetRaffle() {
        document.getElementById('raffle-result').style.display = 'none';
        document.getElementById('spin-wheel-btn').style.display = 'block';
        document.getElementById('spin-wheel-btn').disabled = false;
        document.getElementById('spin-wheel-btn').innerHTML = 'Spin the Wheel!';
        
        const wheel = document.getElementById('raffle-wheel');
        wheel.classList.remove('wheel-spinning');
        wheel.style.transform = 'rotate(0deg)';
        
        if (this.raffleData) {
            this.setupRaffle(this.raffleData.participants);
        }
    }

    addSpinEffects() {
        // Add visual effects during spinning
        const wheel = document.getElementById('raffle-wheel');
        const center = wheel.querySelector('.wheel-center i');
        
        // Animate dice icon
        let iconRotation = 0;
        const iconAnimation = setInterval(() => {
            iconRotation += 45;
            center.style.transform = `rotate(${iconRotation}deg)`;
        }, 100);
        
        setTimeout(() => {
            clearInterval(iconAnimation);
            center.style.transform = 'rotate(0deg)';
        }, 4000);
    }

    createConfetti() {
        // Create confetti animation
        const colors = ['#c4d730', '#2d5016', '#4a7c59', '#ff6b6b', '#4ecdc4'];
        const confettiContainer = document.createElement('div');
        confettiContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10000;
        `;
        document.body.appendChild(confettiContainer);
        
        // Create confetti pieces
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                const color = colors[Math.floor(Math.random() * colors.length)];
                const left = Math.random() * 100;
                const animationDuration = (Math.random() * 3 + 2) + 's';
                const delay = Math.random() * 2 + 's';
                
                confetti.style.cssText = `
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background: ${color};
                    left: ${left}%;
                    top: -10px;
                    border-radius: 50%;
                    animation: confettiFall ${animationDuration} ${delay} ease-out forwards;
                `;
                
                confettiContainer.appendChild(confetti);
            }, i * 50);
        }
        
        // Add confetti animation styles
        if (!document.querySelector('[data-confetti-style]')) {
            const style = document.createElement('style');
            style.setAttribute('data-confetti-style', '');
            style.textContent = `
                @keyframes confettiFall {
                    0% {
                        transform: translateY(-10px) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Clean up after animation
        setTimeout(() => {
            if (confettiContainer.parentNode) {
                confettiContainer.remove();
            }
        }, 6000);
    }

    openExcelImportModal() {
        document.getElementById('excel-import-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.resetFileUpload();
    }

    closeExcelModal() {
        document.getElementById('excel-import-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.resetFileUpload();
    }

    openAnalyticsModal() {
        document.getElementById('analytics-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.loadAnalytics();
    }

    closeAnalyticsModal() {
        document.getElementById('analytics-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async loadAnalytics() {
        try {
            // For now, we'll use local data. In a real implementation, this would call the API
            const employees = Object.entries(this.employees);
            const totalEmployees = employees.length;
            const totalEntries = employees.reduce((sum, [name, data]) => sum + data.entries, 0);
            const topPerformers = employees
                .filter(([name, data]) => data.entries > 0)
                .sort((a, b) => b[1].entries - a[1].entries)
                .slice(0, 5);

            // Update top performers list
            const topPerformersList = document.getElementById('top-performers-list');
            if (topPerformers.length > 0) {
                topPerformersList.innerHTML = topPerformers.map(([name, data], index) => `
                    <div class="top-performer-item">
                        <span class="rank">#${index + 1}</span>
                        <span class="name">${this.escapeHtml(name)}</span>
                        <span class="entries">${data.entries} entries</span>
                    </div>
                `).join('');
            } else {
                topPerformersList.innerHTML = '<p class="no-data">No entries recorded yet</p>';
            }

            // Update recent activity (mock data for now)
            const recentActivityList = document.getElementById('recent-activity-list');
            recentActivityList.innerHTML = '<p class="no-data">Activity tracking coming soon</p>';

        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showAlert('Failed to load analytics data', 'error');
        }
    }

    resetFileUpload() {
        document.getElementById('excel-file').value = '';
        document.getElementById('file-info').style.display = 'none';
        document.getElementById('upload-area').classList.remove('dragover');
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.displayFileInfo(file);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('upload-area').classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('upload-area').classList.remove('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('upload-area').classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (this.isValidExcelFile(file)) {
                document.getElementById('excel-file').files = files;
                this.displayFileInfo(file);
            } else {
                this.showAlert('Please select a valid Excel file (.xlsx or .xls)', 'error');
            }
        }
    }

    isValidExcelFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        return validTypes.includes(file.type) || 
               file.name.toLowerCase().endsWith('.xlsx') || 
               file.name.toLowerCase().endsWith('.xls');
    }

    displayFileInfo(file) {
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        
        document.getElementById('file-info').style.display = 'block';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async uploadExcelFile() {
        const fileInput = document.getElementById('excel-file');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showAlert('Please select a file first', 'error');
            return;
        }

        if (!this.isValidExcelFile(file)) {
            this.showAlert('Please select a valid Excel file (.xlsx or .xls)', 'error');
            return;
        }

        const uploadBtn = document.getElementById('upload-btn');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<div class="loading"></div> Importing...';
        uploadBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/import_excel', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                this.showAlert(data.message, 'success');
                await this.loadEmployees();
                this.closeExcelModal();
                
                // Show detailed import results
                if (data.file_info) {
                    console.log('Import Details:', data);
                }
            }
        } catch (error) {
            this.showAlert('Failed to upload file. Please try again.', 'error');
        } finally {
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }

    async addEmployee() {
        const nameInput = document.getElementById('employee-name');
        const name = nameInput.value.trim();

        if (!name) {
            this.showAlert('Please enter an employee name', 'error');
            return;
        }

        const btn = document.getElementById('add-employee-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<div class="loading"></div> Adding...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name })
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                nameInput.value = '';
                this.showAlert(`Employee "${name}" added successfully!`, 'success');
                await this.loadEmployees();
            }
        } catch (error) {
            this.showAlert('Failed to add employee. Please try again.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async loadEmployees() {
        try {
            const response = await fetch('/api/employees');
            const data = await response.json();
            
            if (data.success && data.employees) {
                this.employees = data.employees;
            } else {
                console.error('Invalid API response:', data);
                this.employees = [];
            }
            
            this.renderEmployees();
            this.updateStatsSmooth();
        } catch (error) {
            console.error('Failed to load employees:', error);
            this.showAlert('Failed to load employees', 'error');
            this.employees = [];
        }
    }

    renderEmployees() {
        const grid = document.getElementById('employees-grid');
        
        if (!this.employees || this.employees.length === 0) {
            grid.innerHTML = `
                <div class="empty-state fade-in">
                                        <h3>No Employees Yet</h3>
                    <p>Add your first employee to start tracking raffle entries and begin your quarterly raffle!</p>
                    <button class="empty-state-action" onclick="document.getElementById('employee-name').focus()">
                                                Add Your First Employee
                    </button>
                </div>
            `;
            const tableBody = document.getElementById('employee-table-body');
            if (tableBody) tableBody.innerHTML = '';
            return;
        }

        // Sort employees by total_entries (descending)
        const sortedEmployees = [...this.employees]
            .sort((a, b) => (b.total_entries || 0) - (a.total_entries || 0));

        // Render cards view with new design
        grid.innerHTML = sortedEmployees.map((employee, index) => `
            <div class="employee-card slide-up" data-employee="${this.escapeHtml(employee.name)}" data-employee-id="${employee.id}" style="animation-delay: ${index * 0.1}s">
                <div class="employee-header">
                    <div class="employee-info">
                        <div class="employee-name">${this.escapeHtml(employee.name)}</div>
                        <div class="employee-department">${employee.department || 'General'}</div>
                    </div>
                    <div class="employee-entries">
                        ${employee.total_entries || 0}
                    </div>
                </div>
                
                <div class="employee-actions">
                    <button class="action-btn action-btn-primary add-entry-btn" data-employee-name="${this.escapeHtml(employee.name)}" data-employee-id="${employee.id}" title="Add raffle entry">
                                                Add Entry
                    </button>
                    <button class="action-btn action-btn-warning clear-points-btn" data-employee-name="${this.escapeHtml(employee.name)}" data-employee-id="${employee.id}" title="Clear all points">
                                                Clear Points
                    </button>
                    <button class="action-btn action-btn-danger delete-employee-btn" data-employee-name="${this.escapeHtml(employee.name)}" title="Delete employee">
                                                Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        // Render table view
        const tableBody = document.getElementById('employee-table-body');
        if (tableBody) {
            tableBody.innerHTML = sortedEmployees.map((employee) => `
                <tr>
                    <td class="employee-name-cell">${this.escapeHtml(employee.name)}</td>
                    <td>${employee.department || 'General'}</td>
                    <td><span class="entries-badge">${employee.total_entries || 0}</span></td>
                    <td>${employee.updated_at || 'No recent activity'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn action-btn-primary add-entry-btn" data-employee-name="${this.escapeHtml(employee.name)}" data-employee-id="${employee.id}" title="Add entry">
                                Add
                            </button>
                            <button class="action-btn action-btn-warning clear-points-btn" data-employee-name="${this.escapeHtml(employee.name)}" title="Clear points">
                                Clear
                            </button>
                            <button class="action-btn action-btn-danger delete-employee-btn" data-employee-name="${this.escapeHtml(employee.name)}" title="Delete">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // Add event delegation for Add Entry and Delete buttons
        this.attachEmployeeActionHandlers();
    }
    
    attachEmployeeActionHandlers() {
        // Remove existing event listeners to avoid duplicates
        document.removeEventListener('click', this.employeeActionHandler);
        
        // Add event delegation for employee action buttons
        this.employeeActionHandler = (e) => {
            if (e.target.classList.contains('add-entry-btn')) {
                e.preventDefault();
                const employeeName = e.target.getAttribute('data-employee-name');
                const employeeId = e.target.getAttribute('data-employee-id');
                console.log('Add Entry clicked for:', employeeName, 'ID:', employeeId);
                this.openAddEntryModal(employeeName, employeeId);
            } else if (e.target.classList.contains('clear-points-btn')) {
                e.preventDefault();
                const employeeName = e.target.getAttribute('data-employee-name');
                const employeeId = e.target.getAttribute('data-employee-id');
                console.log('Clear Points clicked for:', employeeName);
                this.resetEmployeePoints(employeeName, employeeId);
            } else if (e.target.classList.contains('delete-employee-btn')) {
                e.preventDefault();
                const employeeName = e.target.getAttribute('data-employee-name');
                console.log('Delete clicked for:', employeeName);
                this.deleteEmployee(employeeName);
            }
        };
        
        document.addEventListener('click', this.employeeActionHandler);
    }

    openAddEntryModal(employeeName, employeeId) {
        console.log('openAddEntryModal called with:', employeeName, 'ID:', employeeId);
        
        this.currentEmployee = employeeName;
        this.currentEmployeeId = employeeId;
        
        const modalEmployeeName = document.getElementById('modal-employee-name');
        const modal = document.getElementById('add-entry-modal');
        
        console.log('Modal employee name element:', modalEmployeeName);
        console.log('Modal element:', modal);
        
        if (modalEmployeeName) {
            modalEmployeeName.textContent = employeeName;
        } else {
            console.error('modal-employee-name element not found');
        }
        
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            console.log('Modal opened successfully');
        } else {
            console.error('add-entry-modal element not found');
        }
    }

    closeModal() {
        document.getElementById('add-entry-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.currentEmployee = null;
        this.currentEmployeeId = null;
    }

    async addEntryToEmployee(employeeName, activity, entries) {
        try {
            if (!this.currentEmployeeId) {
                throw new Error('No employee ID available');
            }
            
            const response = await fetch(`/api/employee/${this.currentEmployeeId}/add_entry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    activity_name: activity, 
                    activity_category: 'manual', // or determine category
                    entries_awarded: entries 
                })
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                this.showAlert(`Added ${entries} entry(ies) for ${activity}`, 'success');
                await this.loadEmployees();
                this.closeModal();
            }
        } catch (error) {
            this.showAlert('Failed to add entry. Please try again.', 'error');
        }
    }

    async resetEmployeePoints(employeeName, employeeId) {
        if (!confirm(`Are you sure you want to reset ${employeeName}'s raffle points to 0? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/employee/${employeeId}/reset_points`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                this.showAlert(`${employeeName}'s raffle points have been reset to 0`, 'success');
                await this.loadEmployees();
            }
        } catch (error) {
            this.showAlert('Failed to reset points. Please try again.', 'error');
        }
    }

    async deleteEmployee(employeeName) {
        if (!confirm(`Are you sure you want to delete ${employeeName}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/employee/${encodeURIComponent(employeeName)}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                this.showAlert(`Employee "${employeeName}" deleted successfully`, 'success');
                await this.loadEmployees();
            }
        } catch (error) {
            this.showAlert('Failed to delete employee. Please try again.', 'error');
        }
    }

    async resetData() {
        const confirmation = prompt('Type "RESET" to confirm you want to delete all data:');
        if (confirmation !== 'RESET') {
            return;
        }

        try {
            const response = await fetch('/api/reset', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.error) {
                this.showAlert(data.error, 'error');
            } else {
                this.showAlert('All data has been reset successfully', 'success');
                await this.loadEmployees();
            }
        } catch (error) {
            this.showAlert('Failed to reset data. Please try again.', 'error');
        }
    }

    updateStats() {
        const totalEmployees = this.employees ? this.employees.length : 0;
        const totalEntries = this.employees ? this.employees.reduce((sum, emp) => sum + (emp.total_entries || 0), 0) : 0;

        const totalEmployeesEl = document.getElementById('total-employees');
        const totalEntriesEl = document.getElementById('total-entries');
        
        if (totalEmployeesEl) totalEmployeesEl.textContent = totalEmployees;
        if (totalEntriesEl) totalEntriesEl.textContent = totalEntries;
    }

    updateDateInfo() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const formattedDate = now.toLocaleDateString('en-US', options);
        document.getElementById('current-date').textContent = formattedDate;
    }

    showAlert(message, type = 'success') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
                        ${message}
        `;

        const container = document.querySelector('.main-content');
        container.insertBefore(alert, container.firstChild);

        // Auto-remove alert after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.style.animation = 'slideUp 0.3s ease-in-out';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // Enhanced UI Methods
    initAnimations() {
        // Apply stagger animations to employee cards
        const cards = document.querySelectorAll('.employee-card');
        cards.forEach((card, index) => {
            card.classList.add('stagger-item');
            card.style.animationDelay = `${index * 0.1}s`;
        });
        
        // Initialize intersection observer for scroll animations
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '50px'
            });
            
            document.querySelectorAll('[data-animate]').forEach(el => {
                observer.observe(el);
            });
        }
    }
    
    filterEmployees(searchTerm) {
        const cards = document.querySelectorAll('.employee-card');
        const term = searchTerm.toLowerCase().trim();
        
        cards.forEach(card => {
            const name = card.querySelector('.employee-name').textContent.toLowerCase();
            const matches = name.includes(term);
            
            if (matches) {
                card.style.display = 'block';
                card.style.animation = 'fadeInScale 0.3s ease-out';
            } else {
                card.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    if (!card.querySelector('.employee-name').textContent.toLowerCase().includes(term)) {
                        card.style.display = 'none';
                    }
                }, 300);
            }
        });
    }
    
    
    toggleDropdown() {
        const dropdown = document.querySelector('.dropdown-menu');
        dropdown.classList.toggle('show');
    }
    
    closeDropdown() {
        const dropdown = document.querySelector('.dropdown-menu');
        dropdown.classList.remove('show');
    }
    
    animateNumber(elementId, targetValue, duration = 1000) {
        const element = document.getElementById(elementId);
        if (!element) return; // Guard against null elements
        
        const startValue = parseInt(element.textContent) || 0;
        const increment = (targetValue - startValue) / (duration / 16);
        let currentValue = startValue;
        
        const timer = setInterval(() => {
            currentValue += increment;
            if ((increment > 0 && currentValue >= targetValue) || 
                (increment < 0 && currentValue <= targetValue)) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(currentValue);
        }, 16);
    }
    
    animateStatsUpdate() {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.animation = 'pulse 0.6s ease-in-out';
                setTimeout(() => {
                    card.style.animation = '';
                }, 600);
            }, index * 100);
        });
    }
    
    updateTopPerformerStat() {
        if (!this.employees || this.employees.length === 0) {
            this.animateNumber('top-performer-entries', 0);
            return;
        }
        const topEntries = Math.max(...this.employees.map(emp => emp.total_entries || 0), 0);
        this.animateNumber('top-performer-entries', topEntries);
    }
    
    updateDaysRemaining() {
        // Calculate days to end of quarter
        const now = new Date();
        const quarter = Math.floor((now.getMonth() + 3) / 3);
        const endOfQuarter = new Date(now.getFullYear(), quarter * 3, 0);
        const daysLeft = Math.ceil((endOfQuarter - now) / (1000 * 60 * 60 * 24));
        this.animateNumber('days-remaining', Math.max(0, daysLeft));
    }
    
    updateStats() {
        const totalEmployees = (Array.isArray(this.employees)) ? this.employees.length : 0;
        const totalEntries = (Array.isArray(this.employees)) ? this.employees.reduce((sum, emp) => sum + (emp.total_entries || 0), 0) : 0;
        
        this.animateNumber('total-employees', totalEmployees);
        this.animateNumber('total-entries', totalEntries);
        this.updateTopPerformerStat();
        this.updateDaysRemaining();
    }
    
    // Enhanced loading states
    showLoading(element, text = 'Loading...') {
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        element.innerHTML = `
            <div class="loading-container">
                <div class="loading"></div>
                <span class="loading-text">${text}</span>
            </div>
        `;
        element.disabled = true;
    }
    
    hideLoading(element) {
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
        element.disabled = false;
    }
    
    // Enhanced error handling with animations
    showError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.innerHTML = `
            <div class="error-content">
                                <span>${message}</span>
                <button class="error-close">&times;</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Trigger enter animation
        setTimeout(() => errorDiv.classList.add('show'), 10);
        
        // Auto remove
        const timeout = setTimeout(() => this.removeError(errorDiv), duration);
        
        // Manual close
        errorDiv.querySelector('.error-close').onclick = () => {
            clearTimeout(timeout);
            this.removeError(errorDiv);
        };
    }
    
    removeError(errorDiv) {
        errorDiv.classList.add('exit');
        setTimeout(() => errorDiv.remove(), 300);
    }
    
    // Enhanced Employee Management Functions
    toggleEmployeeView(view) {
        const cardsView = document.getElementById('employees-grid');
        const tableView = document.getElementById('employees-table');
        const viewBtns = document.querySelectorAll('.view-btn');
        
        // Update active button
        viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Switch views with animation
        if (view === 'table') {
            cardsView.style.display = 'none';
            tableView.style.display = 'block';
            tableView.classList.add('fade-in');
        } else {
            tableView.style.display = 'none';
            cardsView.style.display = 'grid';
            cardsView.classList.add('fade-in');
        }
        
        // Remove animation class after completion
        setTimeout(() => {
            cardsView.classList.remove('fade-in');
            tableView.classList.remove('fade-in');
        }, 500);
    }
    
    applyFilters() {
        const searchTerm = document.getElementById('employee-search-main')?.value.toLowerCase() || '';
        const deptFilter = document.getElementById('department-filter')?.value || '';
        const entriesFilter = document.getElementById('entries-filter')?.value || '';
        
        const cards = document.querySelectorAll('.employee-card');
        const rows = document.querySelectorAll('#employee-table-body tr');
        
        // Filter cards
        cards.forEach(card => {
            const nameEl = card.querySelector('.employee-name');
            const deptEl = card.querySelector('.employee-department');
            const entriesEl = card.querySelector('.employee-entries');
            
            if (nameEl && deptEl && entriesEl) {
                const name = nameEl.textContent.toLowerCase();
                const dept = deptEl.textContent;
                const entries = parseInt(entriesEl.textContent);
                
                const matchesSearch = name.includes(searchTerm);
                const matchesDept = !deptFilter || dept === deptFilter;
                const matchesEntries = this.matchesEntriesFilter(entries, entriesFilter);
                
                if (matchesSearch && matchesDept && matchesEntries) {
                    card.style.display = 'block';
                    card.classList.add('fade-in');
                } else {
                    card.style.display = 'none';
                }
            }
        });
        
        // Filter table rows
        rows.forEach(row => {
            const nameEl = row.querySelector('.employee-name-cell');
            const entriesEl = row.querySelector('.entries-badge');
            
            if (nameEl && entriesEl) {
                const name = nameEl.textContent.toLowerCase();
                const dept = row.cells[1].textContent;
                const entries = parseInt(entriesEl.textContent);
                
                const matchesSearch = name.includes(searchTerm);
                const matchesDept = !deptFilter || dept === deptFilter;
                const matchesEntries = this.matchesEntriesFilter(entries, entriesFilter);
                
                row.style.display = (matchesSearch && matchesDept && matchesEntries) ? '' : 'none';
            }
        });
    }
    
    matchesEntriesFilter(entries, filter) {
        if (!filter) return true;
        
        switch(filter) {
            case '0': return entries === 0;
            case '1-5': return entries >= 1 && entries <= 5;
            case '6+': return entries >= 6;
            default: return true;
        }
    }
    
    // Enhanced stats update without flickering
    updateStatsSmooth() {
        const totalEmployees = this.employees ? this.employees.length : 0;
        const totalEntries = this.employees ? this.employees.reduce((sum, emp) => sum + (emp.total_entries || 0), 0) : 0;
        
        // Update with smooth transitions
        const employeeEl = document.getElementById('total-employees');
        const entriesEl = document.getElementById('total-entries');
        
        if (employeeEl) {
            employeeEl.style.transition = 'transform 0.2s ease';
            employeeEl.style.transform = 'scale(1.1)';
            employeeEl.textContent = totalEmployees;
            setTimeout(() => {
                employeeEl.style.transform = 'scale(1)';
            }, 200);
        }
        
        if (entriesEl) {
            entriesEl.style.transition = 'transform 0.2s ease';
            entriesEl.style.transform = 'scale(1.1)';
            entriesEl.textContent = totalEntries;
            setTimeout(() => {
                entriesEl.style.transform = 'scale(1)';
            }, 200);
        }
    }
    
    // Show loading state for employee section
    showEmployeeLoading() {
        const grid = document.getElementById('employees-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="loading-employees">
                    <div class="loading-spinner"></div>
                    <p>Loading employees...</p>
                </div>
            `;
        }
    }
}

// Add slide up animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        to {
            transform: translateY(-20px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new RaffleDashboard();
});

// Add some visual enhancements
document.addEventListener('DOMContentLoaded', () => {
    // Add subtle floating animation to logo
    const logoImg = document.querySelector('.logo-img');
    if (logoImg) {
        setInterval(() => {
            logoImg.style.transform += ` translateY(${Math.sin(Date.now() * 0.001) * 1}px)`;
        }, 100);
    }

    // Add subtle parallax effect to header
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.header');
        if (header) {
            const scrolled = window.pageYOffset;
            header.style.transform = `translateY(${scrolled * 0.1}px)`;
        }
    });

    // Add ripple effect to buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
            const button = e.target.classList.contains('btn') ? e.target : e.target.closest('.btn');
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.height, rect.width);
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            ripple.classList.add('ripple');
            
            const rippleStyle = document.createElement('style');
            rippleStyle.textContent = `
                .ripple {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.6);
                    transform: scale(0);
                    animation: ripple-animation 0.6s linear;
                    pointer-events: none;
                }
                @keyframes ripple-animation {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `;
            if (!document.querySelector('[data-ripple-style]')) {
                rippleStyle.setAttribute('data-ripple-style', '');
                document.head.appendChild(rippleStyle);
            }
            
            button.style.position = 'relative';
            button.style.overflow = 'hidden';
            button.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        }
    });
});