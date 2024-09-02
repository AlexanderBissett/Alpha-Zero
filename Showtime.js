const { exec } = require('child_process');

// Function to run a command in a new Command Prompt window
function runCommand(command) {
  exec(`start cmd /k ${command}`);
}

// Run the Scanner bot
runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\Alpha.js');

// Wait 5 seconds before running the B·R·A·I·N bot
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\Brain.mjs');
}, 5000);

// Wait 5 seconds before running the Balancer bot
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Scanner\\Balancer.js');
}, 5000);

// Wait 5 seconds before running the Gambler bot
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\Zero.js');
}, 5000);

// Wait 5 seconds before running the Collector Bot
setTimeout(() => {
  runCommand('node C:\\Users\\Alexander\\AlphaZero\\js\\One.js');
}, 5000);