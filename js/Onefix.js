"use strict";
const { exec } = require('child_process');

// Function to execute a shell command and return the output
const execCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
};

// Function to get the token balance for a given address
const getTokenBalance = async (address) => {
    try {
        const output = await execCommand(`spl-token accounts ${address}`);
        console.log('Command output:', output); // Debugging

        // Use a regular expression to find and extract the balance
        const balanceMatch = output.match(/Balance\s*[\-]+[\s]+([\d.]+)/);
        if (!balanceMatch) throw new Error('Balance value not found in the command output.');

        // Extract the balance from the match
        const balance = parseFloat(balanceMatch[1]);
        if (isNaN(balance)) throw new Error('Balance is not a valid number.');
        
        return balance;
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw error;
    }
};

// Example usage of getTokenBalance
const main = async () => {
    try {
        const address = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'; // Replace with the actual address
        const balance = await getTokenBalance(address);
        console.log(`Token balance for address ${address}: ${balance}`);
    } catch (error) {
        console.error('Failed to get token balance:', error);
    }
};

main();