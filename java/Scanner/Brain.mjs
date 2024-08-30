import { tokenAddresses } from './Current_list.mjs';  // New addresses from Scanner.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Command to run
const command = 'solana balance';

// Define the reserve amount (e.g., 30 SOL)
const reserveAmount = 0.2;

// Execute the command in the cmd
exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error executing command: ${error.message}`);
        return;
    }

    if (stderr) {
        console.error(`Error: ${stderr}`);
        return;
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
        return;
    }
});

// Path to the file where unique addresses will be stored
const addressesFilePath = path.join('./', 'addresses.json');

// Load existing addresses from the file
let existingAddresses = [];
if (fs.existsSync(addressesFilePath)) {
    const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
    existingAddresses = JSON.parse(fileContent);
}

// Merge new token addresses with existing ones and remove duplicates
const combinedAddresses = [...new Set(existingAddresses.concat(tokenAddresses))];

// Save the updated list back to the file
fs.writeFileSync(addressesFilePath, JSON.stringify(combinedAddresses, null, 2));

console.log('Token addresses updated succesfully');

// Loop through each address and execute the command
combinedAddresses.forEach(address => {
    const command = `spl-token create-account "${address}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error creating account for address ${address}: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error output for address ${address}: ${stderr}`);
            return;
        }
        console.log(`Account created for address ${address}: ${stdout}`);
    });
});

