const { exec } = require('child_process');
const path = require('path');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Get the current directory (where the script is located)
const currentDir = __dirname;

// Define paths for Scanner and Master files
const scannerFilePath = path.join(currentDir, 'Scanner', 'Scanner.js');
const masterFilePath = path.join(currentDir, 'Manager.mjs');

// Run the Scanner bot
runCommand(`node ${scannerFilePath}`);

// Wait 5 seconds before running the Master
setTimeout(() => {
  runCommand(`node ${masterFilePath}`);
}, 5000);