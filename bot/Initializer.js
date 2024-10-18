const { exec } = require('child_process');
const path = require('path');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Get the current directory (where the script is located)
const currentDir = __dirname;

// Define paths for Scanner and Manager files
const scannerFilePath = path.join(currentDir, 'Scanner', 'Scanner.js');
const managerFilePath = path.join(currentDir, 'Manager.mjs');

// Run the Scanner bot
runCommand(`node ${scannerFilePath}`);

// Wait 7.5 seconds before running the Manager
setTimeout(() => {
  runCommand(`node ${managerFilePath}`);
}, 7500);

//Alpha-Zero Technical High Liquidity Model 0.2.5 by 101 @ The Organitation