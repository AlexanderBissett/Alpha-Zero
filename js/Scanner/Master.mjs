import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Helper function to run a script
const runScript = (scriptPath) => {
    return new Promise((resolve, reject) => {
        const process = exec(`node ${scriptPath}`);

        // If the script produces output, log it
        process.stdout.on('data', (data) => console.log(`Output from ${scriptPath}: ${data}`));
        process.stderr.on('data', (data) => console.error(`Error from ${scriptPath}: ${data}`));

        // When the script finishes, resolve/reject based on the exit code
        process.on('exit', (code) => {
            if (code === 0) {
                resolve();  // Resolve normally if script exits with code 0
            } else {
                reject(new Error(`Script ${scriptPath} exited with code ${code}`));
            }
        });

        // Handle other signals in case the process is terminated
        process.on('error', (err) => {
            reject(new Error(`Failed to start process: ${err.message}`));
        });
    });
};

// Function to execute scripts in sequence
const executeScripts = async () => {
    const scripts = [
        'C:/Users/Alexander/AlphaZero/js/Scanner/Brain.mjs',
        'C:/Users/Alexander/AlphaZero/js/Zero.js',
        'C:/Users/Alexander/AlphaZero/js/Scanner/Balancer.js',
        'C:/Users/Alexander/AlphaZero/js/One.js'
    ];

    for (const script of scripts) {
        console.log(`\nRunning ${script}...`);
        try {
            await runScript(script);
        } catch (error) {
            console.error(`Failed to execute ${script}: ${error.message}`);
            // Exit early if any script fails
            return;
        }
    }

    console.log('\nAll scripts executed.');
};

// Function to repeatedly execute the script sequence every second
const main = async () => {
    while (true) {
        await executeScripts();
        // Wait for 1 second before the next execution
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

// Start the process
main();