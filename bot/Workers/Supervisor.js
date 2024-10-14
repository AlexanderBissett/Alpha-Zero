import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to introduce a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateReversedAddressBalances() {
    try {
        // Read the addresses from the addresses.json file
        const filePath = path.join(__dirname, 'addresses.json');
        const data = await fs.readFile(filePath, 'utf8');
        const addresses = JSON.parse(data);

        // Filter the reversed addresses and ignore already completed ones
        const reversedAddresses = addresses.filter(addressObj => 
            addressObj.reversed && 
            (addressObj.completed === undefined || addressObj.completed === false)
        );

        if (reversedAddresses.length === 0) {
            console.log('No reversed addresses found or all are already completed.');
            return;
        }
        console.log(`Found ${reversedAddresses.length} reversed addresses to process.`);

        // Function to update balance and mark the address as completed or change reversed to false
        const updateBalance = async (addressObj) => {
            const address = addressObj.address;
            const command = `spl-token accounts ${address}`;
            let attempts = 0;
            const maxAttempts = 3; // Maximum number of retry attempts
            const retryDelay = 10000; // Delay of 10 seconds between retries

            while (attempts < maxAttempts) {
                try {
                    console.log(`Checking balance for reversed address ${address} (Attempt ${attempts + 1})...`);

                    await new Promise((resolve, reject) => {
                        const process = exec(command, (error, stdout, stderr) => {
                            if (error) {
                                reject(`Error executing command for address ${address}: ${error.message}`);
                                return;
                            }

                            if (stderr) {
                                reject(`Standard Error for address ${address}: ${stderr}`);
                                return;
                            }

                            // Extract the balance from the output
                            const lines = stdout.split('\n');
                            console.log(`Command output for ${address}:`, stdout); // Debugging output
                            const balanceLine = lines.find(line => !isNaN(parseFloat(line)));
                            const balance = balanceLine ? parseFloat(balanceLine) : 'Balance not found';

                            if (balance === 'Balance not found') {
                                reject(`Balance not found in the output for address ${address}.`);
                                return;
                            }

                            console.log(`Balance for ${address}: ${balance}`);
                            
                            // Update the `completed` or `reversed` properties based on balance
                            if (balance < 1) {
                                addressObj.completed = true; // Mark as completed if balance is less than 1
                                console.log(`Address ${address} completed (balance < 1).`);
                            } else {
                                addressObj.reversed = false; // If balance >= 1, set reversed to false
                                console.log(`Address ${address} updated to not reversed (balance >= 1).`);
                            }

                            resolve();
                        });

                        // Timeout after 10 seconds if exec doesn't resolve or reject
                        setTimeout(() => {
                            process.kill();
                            reject(`Command for address ${address} timed out after 10 seconds.`);
                        }, 10000);
                    });

                    // If successful, break out of the loop
                    return;
                } catch (err) {
                    console.error(`Error for address ${address} on attempt ${attempts + 1}: ${err}`);
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`Retrying address ${address} in ${retryDelay / 1000} seconds...`);
                        await delay(retryDelay);
                    } else {
                        console.log(`Max attempts reached for address ${address}. Marking as failed.`);
                        addressObj.completed = 'Error'; // Mark as failed after max attempts
                    }
                }
            }
        };

        // Process each reversed address
        for (const addressObj of reversedAddresses) {
            console.log(`Processing reversed address ${addressObj.address}...`);
            try {
                await updateBalance(addressObj);
            } catch (err) {
                console.error(`Failed to process reversed address ${addressObj.address}: ${err.message}`);
                addressObj.completed = 'Error'; // Mark as failed if an exception occurs
            }
        }

        // Write the updated addresses back to the file
        console.log('Writing updated addresses back to addresses.json...');
        await fs.writeFile(filePath, JSON.stringify(addresses, null, 2), 'utf8');
        console.log('Addresses JSON file updated successfully.');
    } catch (err) {
        console.error(`General error: ${err.message}`);
    }
}

// Start the update process
updateReversedAddressBalances();
