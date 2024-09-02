import { exec } from 'child_process';
import { promises as fs } from 'fs';

async function updateAddressBalances() {
    try {
        // Read the addresses from the addresses.json file
        const data = await fs.readFile('addresses.json', 'utf8');
        const addresses = JSON.parse(data);

        // Filter the addresses based on the conditions
        const validAddresses = addresses.filter(addressObj => 
            addressObj.used && 
            !addressObj.reversed
        );

        if (validAddresses.length === 0) {
            console.log('No valid addresses found.');
            return;
        }

        // Function to update the balance for an address
        const updateBalance = (addressObj) => {
            return new Promise((resolve, reject) => {
                const address = addressObj.address;
                const command = `spl-token accounts ${address}`;

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
                    const balanceLine = lines.find(line => !isNaN(parseFloat(line)));
                    const balance = balanceLine ? parseFloat(balanceLine) : 'Balance not found';

                    // Update the address object with the balance
                    addressObj.balance = balance;

                    resolve();
                });
            });
        };

        // Process each valid address
        for (const addressObj of validAddresses) {
            if (addressObj.balance !== undefined) {
                console.log(`Skipping address ${addressObj.address} as it already has a balance.`);
                continue;
            }

            try {
                await updateBalance(addressObj);
                console.log(`Balance for address ${addressObj.address} updated successfully.`);
            } catch (err) {
                console.error(err);
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