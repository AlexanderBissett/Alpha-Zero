import { tokenAddresses } from './Current_list.mjs';  // New addresses from Scanner.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

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

console.log('Updated Token Addresses:', combinedAddresses);


// Command to run
const command = 'solana balance';

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

    // Store the balance as a variable
    const balance = balanceNumber;

    console.log(`Balance: ${balance} SOL`);
});