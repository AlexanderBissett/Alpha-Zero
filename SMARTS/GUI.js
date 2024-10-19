// Import the Electron modules
const { app, BrowserWindow } = require('electron');

function createWindow() {
    // Create a new window with a background color of #212121
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#212121',  // Set the background color to dark gray
        webPreferences: {
            nodeIntegration: true
        }
    });

    // Load an empty page or keep it blank
    win.loadURL('about:blank');  // This opens a blank window
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
