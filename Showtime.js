const { exec } = require('child_process');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Run the Scanner bot
runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\Alpha.js');

// Wait 5 seconds before running the Master
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\Master.mjs');
}, 7500);