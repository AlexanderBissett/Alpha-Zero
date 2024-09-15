import { tokenAddresses } from '../Scanner/scanlog/Secure_current_list.mjs';  // New addresses from Scanner.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

// Convert exec to return a promise
const execPromise = promisify(exec);

// Command to run
const command = 'solana balance';

// Define the reserve amount (e.g., 0.15 SOL)
const reserveAmount = 0.0; // 5 Eur approx.

// Get the directory name from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get the balance
const getBalance = async () => {
    try {
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
            console.error(`Error: ${stderr}`);
            process.exit(1); // Exit on stderr
        }

        // Extract the balance number
        const balanceString = stdout.trim();
        const balanceNumber = parseFloat(balanceString.split(' ')[0]);

        // Calculate the reserve and available balances
        const availableForTrading = balanceNumber - reserveAmount;

        console.log(`Balance: ${balanceNumber} SOL`);
        console.log(`Reserve: ${reserveAmount} SOL`);
        console.log(`Available for Trading: ${availableForTrading} SOL`);

        // Check if the balance is lower than the reserve
        if (balanceNumber < reserveAmount) {
            console.error('Balance is lower than the reserve amount. Exiting.');
            process.exit(1); // Exit with error code
        }

        // Convert availableForTrading to lamports and save it to a file
        await saveAvailableLamports(availableForTrading);

    } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        process.exit(1); // Exit on error
    }
};

// New function to convert available SOL to lamports and write to file
const saveAvailableLamports = async (availableForTrading) => {
    try {
        const lamports = availableForTrading * 1_000_000_000;  // 1 SOL = 1,000,000,000 lamports
        const lamportsFilePath = path.join(__dirname, 'current_capital.json');

        // Write the lamports value to the file
        fs.writeFileSync(lamportsFilePath, JSON.stringify({ lamports }, null, 2));

        console.log(`Available lamports (${lamports}) saved to ${lamportsFilePath}`);
    } catch (error) {
        console.error(`Error saving lamports data: ${error.message}`);
    }
};

// Main function to handle script execution
const main = async () => {
    await getBalance();

    // Path to the file where unique addresses will be stored
    const addressesFilePath = path.join(__dirname, 'addresses.json');

    // Load existing addresses from the file
    let existingAddresses = [];
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        existingAddresses = JSON.parse(fileContent);
    }

    // Convert the existing addresses to a map for quick lookup
    const existingAddressesMap = new Map(existingAddresses.map(entry => [entry.address, entry]));

    // Add new token addresses to the map, setting "used" to false, "reversed" to false, "wallet" to false, and "scannedAt" to the current Unix timestamp if they don't already exist
    tokenAddresses.forEach(([address, decimals]) => {
        if (!existingAddressesMap.has(address)) {
            existingAddressesMap.set(address, { 
                address: address, 
                decimals: decimals, 
                used: false, 
                reversed: false, 
                wallet: false, 
                scannedAt: Math.floor(Date.now() / 1000)  // Add the scannedAt field with current Unix timestamp
            });
        }
    });

    // Convert the map back to an array
    const combinedAddresses = Array.from(existingAddressesMap.values());

    // Save the updated list back to the file
    fs.writeFileSync(addressesFilePath, JSON.stringify(combinedAddresses, null, 2));

    console.log('Token addresses updated successfully');

    // Loop through each address and execute the command
    for (let i = 0; i < combinedAddresses.length; i++) {
        const entry = combinedAddresses[i];

        // Skip the address if wallet is already true
        if (entry.wallet) {
            console.log(`Skipping address ${entry.address} as it is already marked with wallet: true.`);
            continue;
        }

        const address = entry.address;
        const createAccountCommand = `spl-token create-account "${address}"`;

        try {
            const { stdout, stderr } = await execPromise(createAccountCommand);

            if (stderr) {
                // Check if the error indicates the account already exists
                if (stderr.includes("Error: Account already exists:")) {
                    console.warn(`Account already exists for address ${address}. Marking wallet as true.`);
                    entry.wallet = true;
                } else {
                    console.error(`Error output for address ${address}: ${stderr}`);
                    continue;
                }
            } else {
                console.log(`Account created for address ${address}: ${stdout}`);
                entry.wallet = true;
            }

            // Save the updated list back to the file
            fs.writeFileSync(addressesFilePath, JSON.stringify(combinedAddresses, null, 2));

        } catch (error) {
            // Analyze the error message in the catch block
            if (error.message.includes("Error: Account already exists:")) {
                console.warn(`Account already exists for address ${address}. Marking wallet as true.`);
                entry.wallet = true;

                // Save the updated list back to the file
                fs.writeFileSync(addressesFilePath, JSON.stringify(combinedAddresses, null, 2));
            } else {
                console.error(`Error creating account for address ${address}: ${error.message}`);
            }
        }
    }
};

// Run the main function immediately as well
main();