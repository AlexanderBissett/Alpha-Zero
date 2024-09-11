import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

// Manually define __dirname in ECMAScript modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to generate a timestamped log file path
const getLogFilePath = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(__dirname, 'ActivityLog', `activitylog-${timestamp}.txt`);
};

// Helper function to write to the log file
const logToFile = (message, logFilePath) => {
    try {
        fs.appendFileSync(logFilePath, message + '\n', 'utf8');
    } catch (err) {
        console.error(`Failed to write to log file: ${err.message}`);
    }
};

// Helper function to log the current time
const logCurrentTime = (logFilePath) => {
    const currentTime = new Date().toLocaleString();
    logToFile(`Current time: ${currentTime}`, logFilePath);
};

// Helper function to run a script
const runScript = async (scriptPath, logFilePath) => {
    try {
        const { stdout, stderr } = await execPromise(`node ${scriptPath}`);

        if (stdout) {
            logToFile(`Output from ${scriptPath}: ${stdout}`, logFilePath);
        }
        if (stderr) {
            logToFile(`Error from ${scriptPath}: ${stderr}`, logFilePath);
        }
    } catch (err) {
        const errorMessage = `Failed to execute ${scriptPath}: ${err.message}`;
        logToFile(errorMessage, logFilePath);
        console.error(errorMessage); // Print to console for immediate feedback
        throw err;
    }
};

// Function to execute scripts in sequence
const executeScripts = async (logFilePath) => {
    const scripts = [
        path.join(__dirname, 'Workers', 'Security.js'),
        path.join(__dirname, 'Workers', 'Banker.mjs'),
        path.join(__dirname, 'Traders', 'Buyer.js'),
        path.join(__dirname, 'Workers', 'Accountant.js'),
        path.join(__dirname, 'Traders', 'Seller.js')
    ];

    for (const script of scripts) {
        const startMessage = `\nRunning ${script}...`;
        logToFile(startMessage, logFilePath);
        try {
            await runScript(script, logFilePath);
        } catch (error) {
            const failMessage = `Failed to execute ${script}: ${error.message}`;
            logToFile(failMessage, logFilePath);
            // Exit early if any script fails
            return;
        }
    }

    logToFile('\nAll scripts executed.', logFilePath);
};

// Function to start the process and manage log files
const main = async () => {
    let logFilePath = getLogFilePath();

    const logFileSwitchInterval = 5 * 60 * 1000; // 5 minutes

    setInterval(() => {
        logFilePath = getLogFilePath();
        logCurrentTime(logFilePath);
    }, logFileSwitchInterval);

    while (true) {
        await executeScripts(logFilePath);
        // Wait for 1 second before the next execution
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

// Ensure the log directory exists
const ensureLogDirectoryExists = () => {
    const logDir = path.dirname(getLogFilePath());
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
};

// Ensure the log directory exists before starting
ensureLogDirectoryExists();

// Start the process
main();