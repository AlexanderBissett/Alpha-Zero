const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Get the current directory (where the script is located)
const currentDir = __dirname;

// Define paths for Scanner and Manager files
const scannerFilePath = path.join(currentDir, 'Scanner', 'Scanner.js');
const managerFilePath = path.join(currentDir, 'Manager.mjs');

// Define path for the scanlog directory
const scanlogDir = path.join(currentDir, 'Scanner', 'scanlog');

// Check if the scanlog directory exists, if not, create it
if (!fs.existsSync(scanlogDir)) {
  fs.mkdirSync(scanlogDir, { recursive: true });  // 'recursive: true' ensures that any parent directories are created if they don't exist
  console.log(`Directory ${scanlogDir} created.`);
} else {
  console.log(`Directory ${scanlogDir} already exists.`);
}

// Run the Scanner bot
runCommand(`node ${scannerFilePath}`);

// Watch the scanlog directory for file creation
fs.watch(scanlogDir, (eventType, filename) => {
  if (eventType === 'rename' && filename === 'Current_list.mjs') {
    console.log(`Detected creation of ${filename}. Launching Manager...`);

    // Run the Manager bot
    runCommand(`node ${managerFilePath}`);
  }
});

//Alpha-Zero Fundamental Model 0.2.3 by 101 @ The Organitation