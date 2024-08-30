import { tokenAddresses } from './Current_list.mjs';  // New addresses from Scanner.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Convert exec to return a promise
const execPromise = promisify(exec);

// Command to run
const command = 'solana balance';

// Define the reserve amount (e.g., 0.15 SOL)
const reserveAmount = 0.0015; // 20 Eur aprox.

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

    } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        process.exit(1); // Exit on error
    }
};

// Main function to handle script execution
const main = async () => {
    await getBalance();

    // Path to the file where unique addresses will be stored
    const addressesFilePath = path.join('./', 'addresses.json');

    // Load existing addresses from the file
    let existingAddresses = [];
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        existingAddresses = JSON.parse(fileContent);
    }

    // Convert the existing addresses to a map for quick lookup
    const existingAddressesMap = new Map(existingAddresses.map(entry => [entry.address, entry]));

    // Add new token addresses to the map, setting "used" to false and "reversed" to false if they don't already exist
    tokenAddresses.forEach(address => {
        if (!existingAddressesMap.has(address)) {
            existingAddressesMap.set(address, { address: address, used: false, reversed: false });
        }
    });

    // Convert the map back to an array
    const combinedAddresses = Array.from(existingAddressesMap.values());

    // Save the updated list back to the file
    fs.writeFileSync(addressesFilePath, JSON.stringify(combinedAddresses, null, 2));

    console.log('Token addresses updated successfully');

    // Loop through each address and execute the command
    combinedAddresses.forEach(entry => {
        const address = entry.address;
        const createAccountCommand = `spl-token create-account "${address}"`;

        execPromise(createAccountCommand).then(({ stdout, stderr }) => {
            if (stderr) {
                console.error(`Error output for address ${address}: ${stderr}`);
                return;
            }
            console.log(`Account created for address ${address}: ${stdout}`);
        }).catch(error => {
            console.error(`Error creating account for address ${address}: ${error.message}`);
        });
    });
};

// Define the interval (5 minutes and 5 seconds)
const interval = 5 * 60 * 1000; // Convert to milliseconds

// Start the interval
setInterval(main, interval);

// Run the main function immediately as well
main();