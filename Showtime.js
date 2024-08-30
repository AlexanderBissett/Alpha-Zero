const { exec } = require('child_process');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Run the first script
runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\test1.js');

// Wait 5 seconds before running the second script
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\test2.mjs');
}, 5000);