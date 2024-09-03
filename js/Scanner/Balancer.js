import { exec } from 'child_process';
import { promises as fs } from 'fs';

// Function to introduce a delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateAddressBalances() {
    try {
        // Read the addresses from the addresses.json file
        const data = await fs.readFile('addresses.json', 'utf8');
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

        // Function to update the balance for an address with retry logic
        const updateBalance = async (addressObj) => {
            const address = addressObj.address;
            const command = `spl-token accounts ${address}`;
            let attempts = 0;
            const maxAttempts = 3; // Maximum number of retry attempts
            const retryDelay = 10000; // Delay in milliseconds (10 seconds)

            while (attempts < maxAttempts) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        exec(command, (error, stdout, stderr) => {
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

                            // Update the address object with the balance
                            addressObj.balance = balance;

                            resolve();
                        });
                    });

                    // If successful, break out of the loop
                    console.log(`Balance for address ${address} updated successfully.`);
                    return;
                } catch (err) {
                    console.error(err);

                    // Increment the attempt count and wait before retrying
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                        await delay(retryDelay);
                    } else {
                        console.log(`Max attempts reached for address ${address}.`);
                        throw new Error(`Failed to update balance for address ${address} after ${maxAttempts} attempts.`);
                    }
                }
            }
        };

        // Process each valid address
        for (const addressObj of validAddresses) {
            try {
                await updateBalance(addressObj);
            } catch (err) {
                console.error(`Final error for address ${addressObj.address}: ${err.message}`);
            }
        }

        // Write the updated addresses back to the file
        await fs.writeFile('addresses.json', JSON.stringify(addresses, null, 2), 'utf8');
        console.log('Addresses JSON file updated successfully.');
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

// Set an interval to call the function every 5 seconds
setInterval(updateAddressBalances, 5000);