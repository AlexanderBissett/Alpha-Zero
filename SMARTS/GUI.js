// Import the Electron modules
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    // Create a new window with a dark gray background
    const win = new BrowserWindow({
        width: 800,              // Default width before maximizing
        height: 600,             // Default height before maximizing
        backgroundColor: '#212121',  // Set the background color to dark gray
        webPreferences: {
            nodeIntegration: true,          // Allow node integration
            contextIsolation: false,        // Disable context isolation to allow inline scripts to run
        }
    });

    // Maximize the window when it opens
    win.maximize();

    // Load the external HTML file
    win.loadFile(path.join(__dirname, 'index.html'));
}

// Run the createWindow function when Electron has initialized
app.whenReady().then(createWindow);

// Quit the app when all windows are closed (for non-macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOS specific behavior for reactivating the app
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
