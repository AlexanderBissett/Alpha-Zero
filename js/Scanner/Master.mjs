import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// Function to generate a timestamped log file path
const getLogFilePath = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `C:/Users/Alexander/AlphaZero/js/Scanner/activitylog/activitylog-${timestamp}.txt`;
};

// Helper function to write to the log file
const logToFile = (message, logFilePath) => {
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
};

// Helper function to log the current time
const logCurrentTime = (logFilePath) => {
    const currentTime = new Date().toLocaleString();
    logToFile(`Current time: ${currentTime}`, logFilePath);
};

// Helper function to run a script
const runScript = (scriptPath, logFilePath) => {
    return new Promise((resolve, reject) => {
        const process = exec(`node ${scriptPath}`);

        // If the script produces output, log it to the file
        process.stdout.on('data', (data) => {
            const outputMessage = `Output from ${scriptPath}: ${data}`;
            logToFile(outputMessage, logFilePath);
        });
        process.stderr.on('data', (data) => {
            const errorMessage = `Error from ${scriptPath}: ${data}`;
            logToFile(errorMessage, logFilePath);
        });

        // When the script finishes, resolve/reject based on the exit code
        process.on('exit', (code) => {
            if (code === 0) {
                resolve();  // Resolve normally if script exits with code 0
            } else {
                const exitError = new Error(`Script ${scriptPath} exited with code ${code}`);
                logToFile(exitError.message, logFilePath);
                reject(exitError);
            }
        });

        // Handle other signals in case the process is terminated
        process.on('error', (err) => {
            const errorMessage = `Failed to start process: ${err.message}`;
            logToFile(errorMessage, logFilePath);
            reject(new Error(errorMessage));
        });
    });
};

// Function to execute scripts in sequence
const executeScripts = async (logFilePath) => {
    const scripts = [
        'C:/Users/Alexander/AlphaZero/js/Scanner/Brain.mjs',
        'C:/Users/Alexander/AlphaZero/js/Zero.js',
        'C:/Users/Alexander/AlphaZero/js/Scanner/Balancer.js',
        'C:/Users/Alexander/AlphaZero/js/One.js'
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

// Start the process
main();