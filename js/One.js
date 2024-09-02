"use strict";
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Transaction, VersionedTransaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { NATIVE_MINT } = require('@solana/spl-token');
const axios = require('axios');
const { fetchTokenAccountData, owner, connection } = require('C:/Users/Alexander/AlphaZero/js/A0');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');

// Function to get balance for a specific address
const getBalanceForAddress = (address) => {
    return new Promise((resolve, reject) => {
        exec(`spl-token accounts "${address}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                reject(error);
                return;
            }
            console.log(`Token accounts output for ${address}: ${stdout}`);
            
            // Use regex to extract the balance from the output
            const balanceMatch = stdout.match(/Balance\s*--------\s*([\d.]+)/);
            if (balanceMatch) {
                const balance = parseFloat(balanceMatch[1].trim());
                if (!isNaN(balance)) {
                    console.log(`Balance for address ${address}: ${balance}`);
                    resolve(balance);
                } else {
                    console.error(`Failed to parse balance for address ${address}. Balance match: "${balanceMatch[1]}"`);
                    reject(new Error('Failed to parse balance.'));
                }
            } else {
                console.error('Failed to extract balance from token accounts output.');
                reject(new Error('Failed to extract balance.'));
            }
        });
    });
};

// Function to run all the logic, including loading addresses
const runProcess = () => {
    // Path to the file where unique addresses are stored
    const addressesFilePath = path.join(__dirname, 'Scanner', 'addresses.json');

    // Load addresses from the file
    let addresses = [];
    if (fs.existsSync(addressesFilePath)) {
        const fileContent = fs.readFileSync(addressesFilePath, 'utf-8');
        addresses = JSON.parse(fileContent);
    } else {
        console.error('addresses.json file not found.');
        return; // Exit the function if the file is not found
    }

    // Function to mark an address as reversed and record the timestamp
    const markAddressAsReversed = (address) => {
        const timestamp = new Date().toISOString(); // Get the current timestamp in ISO format
        addresses = addresses.map(addr =>
            addr.address === address ? { ...addr, reversed: true, reversedAt: timestamp } : addr
        );
        fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
    };

    // Function to process an address (swap to SOL)
    const processAddress = (inputMint, decimals) => {
        return (async () => {
            const outputMint = NATIVE_MINT.toBase58(); // Convert to SOL
            const amount = 2.679397 * 10 ** decimals; // Use the decimals from the address
            const slippage = 5; // in percent, for this example, 0.5 means 0.5%
            const txVersion = 'LEGACY'; // or 'LEGACY'
            const isV0Tx = txVersion === 'LEGACY';

            const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()];

            let tokenAccounts;
            try {
                tokenAccounts = (await fetchTokenAccountData()).tokenAccounts;
            } catch (error) {
                console.error('Error fetching token account data:', error);
                return;
            }

            const inputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === inputMint)?.publicKey;
            const outputTokenAcc = tokenAccounts.find(a => a.mint.toBase58() === outputMint)?.publicKey;

            if (!inputTokenAcc && !isInputSol) {
                console.error('Do not have input token account');
                return;
            }

            let data, swapResponse, swapTransactions, allTxBuf, allTransactions;
            try {
                data = (await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)).data;
                console.log("Fetched priority fee data:", data);

                swapResponse = (await axios.get(`${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`)).data;
                console.log("Fetched swap response:", swapResponse);

                if (!swapResponse || !swapResponse.data) {
                    console.error('Swap response data is undefined or invalid');
                    return;
                }

                swapTransactions = (await axios.post(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
                    computeUnitPriceMicroLamports: String(data.data.default.h),
                    swapResponse: swapResponse,
                    txVersion: txVersion,
                    wallet: owner.publicKey.toBase58(),
                    wrapSol: isInputSol,
                    unwrapSol: isOutputSol, // true means output mint receives SOL
                    inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
                    outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
                })).data;

                console.log("Fetched swap transactions:", swapTransactions);

                if (!swapTransactions || !swapTransactions.data) {
                    console.error('Swap transactions data is undefined or invalid');
                    return;
                }

                allTxBuf = swapTransactions.data.map(tx => Buffer.from(tx.transaction, 'base64'));
                allTransactions = allTxBuf.map(txBuf => isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf));
            } catch (error) {
                console.error('Error fetching or processing transactions:', error);
                return;
            }

            console.log(`Total ${allTransactions.length} transactions`, swapTransactions);
            let idx = 0;
            if (!isV0Tx) {
                for (const tx of allTransactions) {
                    try {
                        console.log(`${++idx} transaction sending...`);
                        tx.sign(owner);
                        console.log('Signed transaction:', tx);
                        const txId = await sendAndConfirmTransaction(connection, tx, [owner], { skipPreflight: true });
                        console.log(`${idx} transaction confirmed, txId: ${txId}`);
                        markAddressAsReversed(inputMint);  // Mark as reversed after successful transaction
                    } catch (error) {
                        console.error('Error sending transaction:', error);
                    }
                }
            } else {
                for (const tx of allTransactions) {
                    try {
                        idx++;
                        tx.sign([owner]);
                        console.log('Signed transaction:', tx);
                        const txId = await connection.sendTransaction(tx, { skipPreflight: true });
                        const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
                        console.log(`${idx} transaction sending..., txId: ${txId}`);
                        await connection.confirmTransaction({
                            blockhash: blockhash,
                            lastValidBlockHeight: lastValidBlockHeight,
                            signature: txId,
                        }, 'confirmed');
                        console.log(`${idx} transaction confirmed`);
                        markAddressAsReversed(inputMint);  // Mark as reversed after successful transaction
                    } catch (error) {
                        console.error('Error sending transaction:', error);
                    }
                }
            }
        })();
    };

    // Function to process each address one by one
    const processAddresses = async () => {
        const nonReversedAddresses = addresses.filter(addr => !addr.reversed); // Get all non-reversed addresses

        if (nonReversedAddresses.length === 0) {
            console.log("No non-reversed addresses found, will check again in 5 seconds.");
            return;
        }

        for (const addressObj of nonReversedAddresses) {
            const { address, decimals } = addressObj; // Extract address and decimals

            // First, get the balance for the current address
            const balance = getBalanceForAddress(address);
            if (balance === null) {
                console.log(`Skipping address ${address} due to error in balance retrieval.`);
                continue;
            }

            // Now, proceed with processing the address as before
            console.log("Processing address:", address);
            await processAddress(address, decimals); // Pass decimals to processAddress
            // MarkAddressAsReversed is now inside processAddress and called only on success
        }
    };

    // Start processing
    processAddresses();
};

// Set an interval to run the runProcess function every 5 seconds
setInterval(runProcess, 500000); // 5000 milliseconds = 5 seconds

// Start processing immediately
runProcess();