import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to introduce a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateAddressBalances() {
    try {
        // Read the addresses from the addresses.json file
        const filePath = path.join(__dirname, 'addresses.json');
        const data = await fs.readFile(filePath, 'utf8');
        const addresses = JSON.parse(data);

        // Filter the addresses based on the conditions
        const validAddresses = addresses.filter(addressObj => 
            addressObj.used && 
            !addressObj.reversed && 
            addressObj.balance === undefined // Ignore addresses that already have a balance
        );

        if (validAddresses.length === 0) {
            console.log('No valid addresses found.');
            return;
        }
        console.log(`Found ${validAddresses.length} valid addresses.`);

        // Function to update the balance for an address with retry logic
        const updateBalance = async (addressObj) => {
            const address = addressObj.address;
            const command = `spl-token accounts ${address}`;
            let attempts = 0;
            const maxAttempts = 3; // Maximum number of retry attempts
            const retryDelay = 10000; // Reduced delay to 10 seconds

            while (attempts < maxAttempts) {
                try {
                    console.log(`Attempting to update balance for address ${address} (Attempt ${attempts + 1})...`);
                    
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
                            console.log(`Command output for ${address}:`, stdout); // Added for debugging
                            const balanceLine = lines.find(line => !isNaN(parseFloat(line)));
                            const balance = balanceLine ? parseFloat(balanceLine) : 'Balance not found';

                            if (balance === 'Balance not found') {
                                reject(`Balance not found in the output for address ${address}.`);
                                return;
                            }

                            // Update the address object with the balance
                            addressObj.balance = balance;
                            console.log(`Balance for address ${address} set to ${balance}.`);

                            resolve();
                        });

                        // Timeout after 10 seconds if exec doesn't resolve or reject
                        setTimeout(() => {
                            process.kill();
                            reject(`Command for address ${address} timed out after 10 seconds.`);
                        }, 10000);
                    });

                    // If successful, break out of the loop
                    console.log(`Balance for address ${address} updated successfully.`);
                    return;
                } catch (err) {
                    console.error(`Error for address ${address} on attempt ${attempts + 1}: ${err}`);
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`Retrying address ${address} in ${retryDelay / 1000} seconds...`);
                        await delay(retryDelay);
                    } else {
                        console.log(`Max attempts reached for address ${address}. Marking as failed.`);
                        addressObj.balance = 'Error'; // Mark as failed after max attempts
                    }
                }
            }
        };

        // Process each valid address
        for (const addressObj of validAddresses) {
            console.log(`Processing address ${addressObj.address}...`);
            try {
                await updateBalance(addressObj);
            } catch (err) {
                console.error(`Failed to process address ${addressObj.address}: ${err.message}`);
                addressObj.balance = 'Error'; // Mark as failed if an exception occurs
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
updateAddressBalances();