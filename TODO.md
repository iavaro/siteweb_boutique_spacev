# FiveM Server Settings Page - Implementation Plan

## Task: Add a FiveM Server Settings page in the admin panel to generate API keys

### Steps to Complete:

1. [x] **Backend**: Update admin-rp.js to auto-generate API key when creating a FiveM server
2. [x] **Frontend**: Add FiveM Settings tab content in admin.html
3. [x] **Frontend**: Add generate/regenerate API key functionality in scripts.js
4. [x] **Frontend**: Add copy-to-clipboard functionality for API keys

### Files Modified:
- `backend/src/routes/admin-rp.js` - Auto-generate API key + regenerate endpoint
- `frontend/admin.html` - FiveM Settings tab content + JavaScript functions
- `public/scripts.js` - Added regenerateApiKey function

### Features Implemented:
- Auto-generate API key when creating a new server
- Regenerate API key for existing servers
- Copy API key to clipboard
- View/Edit/Delete servers
- Enable/Disable server status
- FiveM integration code snippet for reference

