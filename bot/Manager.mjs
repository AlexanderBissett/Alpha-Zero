import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

// Manually define __filename and __dirname in ECMAScript modules
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

// Helper function to run a script with a timeout
const runScriptWithTimeout = async (scriptPath, logFilePath, timeout) => {
    try {
        const scriptPromise = execPromise(`node ${scriptPath}`);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Script timed out')), timeout)
        );

        // Use Promise.race to apply the timeout
        const { stdout, stderr } = await Promise.race([scriptPromise, timeoutPromise]);

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
    }
};

// Function to execute scripts in sequence with timeout for non-Buyer.js and non-Seller.js scripts
const executeScripts = async (logFilePath) => {
    const scripts = [
        path.join(__dirname, 'Workers', 'Security.js'),
        path.join(__dirname, 'Workers', 'Banker.mjs'),
        path.join(__dirname, 'Workers', 'Cleaner.cjs'),
        path.join(__dirname, 'Traders', 'Buyer.js'),
        path.join(__dirname, 'Data', 'Lead_Scientist.cjs'),
        path.join(__dirname, 'Workers', 'Accountant.js'),
        path.join(__dirname, 'Data', 'Scientist.cjs'),
        path.join(__dirname, 'Traders', 'Seller.js')
    ];

    for (const script of scripts) {
        const startMessage = `\nRunning ${script}...`;
        logToFile(startMessage, logFilePath);

        const scriptName = path.basename(script);
        const isBuyerOrSeller = scriptName === 'Buyer.js' || scriptName === 'Seller.js';

        // Timeout of 2 minutes (120000 ms) for non-Buyer.js and non-Seller.js scripts
        const timeout = isBuyerOrSeller ? 0 : 120000;

        try {
            if (timeout) {
                await runScriptWithTimeout(script, logFilePath, timeout);
            } else {
                await execPromise(`node ${script}`);
            }
        } catch (error) {
            const failMessage = `Error while executing ${script}: ${error.message}`;
            logToFile(failMessage, logFilePath);
        }
    }

    logToFile('\nAll scripts attempted.', logFilePath);
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
    const logDir = path.join(__dirname, 'ActivityLog'); // Ensure ActivityLog folder is created
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
};

// Ensure the log directory exists before starting
ensureLogDirectoryExists();

// Start the process
main();