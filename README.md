# Home Instead Quarterly Raffle Dashboard

A beautiful, animated web-based dashboard for tracking employee raffle entries based on quarterly performance metrics.

## Features

- 🎯 **Track Three Tiers of Performance**
  - High-Impact Actions (3 entries each)
  - Strong Contributions (2 entries each)  
  - Everyday Excellence (1 entry each)

- 🎨 **Beautiful UI/UX**
  - Home Instead brand colors (green and yellow)
  - Smooth animations and transitions
  - Responsive design for all devices
  - Interactive modal system

- 📊 **Real-time Dashboard**
  - Add/remove employees
  - **Import employees from Excel files (.xlsx/.xls)**
  - Track individual activities
  - View entry counts and rankings
  - Export-ready data

- 🚀 **Easy Deployment**
  - Single-page application
  - Git-ready for web hosting
  - No database required (uses JSON file storage)

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run locally:**
   ```bash
   python app.py
   ```

3. **Visit:** http://localhost:5000

## Deployment Options

### Heroku
1. Create a new Heroku app
2. Connect your GitHub repository
3. Deploy from the main branch

### Railway
1. Import project from GitHub
2. Deploy automatically

### Render
1. Connect GitHub repository
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `gunicorn app:app`

### GitHub Pages + Backend Hosting
- Host static files on GitHub Pages
- Deploy Flask backend on Railway/Render/Heroku

## Raffle Categories

### High-Impact Actions (3 Entries)
- Perfect attendance for entire quarter
- Referral of new Care Professional (works at least one shift)
- Covering 5+ open/last-minute shifts in quarter

### Strong Contributions (2 Entries)
- Covering 1-4 open/last-minute shifts
- Completing required training on time
- Going above and beyond (recognized by office staff)
- Participating in 2+ company events/meetings

### Everyday Excellence (1 Entry)
- Proper uniform and badge consistently
- Care notes accurate and on time
- Work anniversary celebration

## Excel Import Feature

### How to Import Employees:
1. Click the "Import Excel" button
2. Upload your .xlsx or .xls file (drag & drop or browse)
3. The system will automatically detect employee names
4. All employees are imported with 0 raffle entries to start

### Excel File Requirements:
- Must contain employee names in a column
- Common column names: "Name", "Employee Name", "Caregiver", "Staff"
- Supports both .xlsx and .xls formats
- Duplicate employees are automatically skipped

## Technology Stack

- **Backend:** Flask (Python)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Excel Processing:** openpyxl (lightweight, no numpy dependency)
- **Storage:** JSON file (no database required)
- **Deployment:** Gunicorn + any cloud platform

## File Structure

```
raffle-dashboard/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── Procfile              # Deployment config
├── runtime.txt           # Python version
├── templates/
│   └── dashboard.html    # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Styling and animations
│   └── js/
│       └── script.js     # Interactive functionality
└── raffle_data.json      # Data storage (auto-created)
```

## Customization

- **Colors:** Update CSS variables in `style.css`
- **Activities:** Modify categories in `dashboard.html`
- **Branding:** Update logo and company name in templates

## Support

Built for Home Instead Senior Care quarterly raffle tracking.
