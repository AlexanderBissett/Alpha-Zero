import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Define the folder path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFolder = path.join(__dirname, "scanlog");

// Ensure the log folder exists
if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder, { recursive: true });
}

// Function to execute the API request and save the results
function fetchAndSaveTokenResults() {
  // Calculate the time you want to measure from in seconds
  let days = 1;
  let hours = 1;
  let minutes = 5;
  let seconds = 60;
  let desired_time = days * hours * minutes * seconds;

  // Get the current time in seconds since the epoch
  const time_right_now = Math.floor(Date.now() / 1000);
  const time_filter = time_right_now - desired_time;

  // Define a hashmap (Map in JavaScript) to store the results
  const tokenResults = new Map();
  const tokenAddresses = new Map(); // Changed to a Map to store decimals

  axios
    .post(
      "https://graph.defined.fi/graphql",
      {
        // Query for Raydium
        query: `{
  filterTokens(
    filters: {
        createdAt : { gte: ${time_filter} }
        volume1: {gte: 100000}
        liquidity: {gte: 100000}
        priceUSD: {gte: 0.03}
        exchangeAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
        network: [1399811149]
    }
    limit: 5
  ) {
    results {
      volume1
      liquidity
      marketCap
      priceUSD
      holders
      buyCount1
      sellCount1
      txnCount1
      change1
      high1
      low1
      uniqueBuys1
      uniqueSells1
      uniqueTransactions1
      exchanges {
        name
      }
      token {
        address
        decimals
        name
        networkId
        symbol
      }
    }
  }
}`
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "f489353be7368dc360236c9e9555c629cabad054" // API key Codex
        }
      }
    )
    .then((response) => {
      const tokens = response.data.data.filterTokens.results;

      // Store each token result in the hashmap using the token address as the key
      tokens.forEach((token) => {
        tokenResults.set(token.token.address, {
          volume1: token.volume1,
          liquidity: token.liquidity,
          marketCap: token.marketCap,
          priceUSD: token.priceUSD,
          holders: token.holders,
          buyCount1: token.buyCount1,
          sellCount1: token.sellCount1,
          txnCount1: token.txnCount1,
          change1: token.change1,
          high1: token.high1,
          low1: token.low1,
          uniqueBuys1: token.uniqueBuys1,
          uniqueSells1: token.uniqueSells1,
          uniqueTransactions1: token.uniqueTransactions1,
          exchanges: token.exchanges.map((exchange) => exchange.name),
          name: token.token.name,
          decimals: token.token.decimals,
          symbol: token.token.symbol,
          networkId: token.token.networkId,
        });
        tokenAddresses.set(token.token.address, token.token.decimals); // Collect token addresses with decimals
      });

      // Get the current date and time for the filename in the desired format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      const formattedDate = `${year}-${month}-${day}--${hours}-${minutes}-${seconds}`;
      const filenameBase = `TokenResults_${formattedDate}`;
      const txtFilename = path.join(logFolder, `${filenameBase}.txt`);
      const jsFilename = path.join(logFolder, `Current_list.mjs`);

      // Write the token addresses to a JavaScript file with decimals
      const tokenAddressesContent = `export const tokenAddresses = ${JSON.stringify(Array.from(tokenAddresses.entries()))};`;
      fs.writeFileSync(jsFilename, tokenAddressesContent);
      console.log(`Token addresses with decimals written to ${jsFilename}`);

      // Format the output for the text file
      let output = "Token Results:\n";
      tokenResults.forEach((value, key) => {
        output += `\n`;
        output += `==========================================================================================\n`;
        output += `==========================================================================================\n`;
        output += `Basic info:\n`;
        output += `Token Address: ${key}\n`;
        output += `Name: ${value.name}\n`;
        output += `Symbol: ${value.symbol}\n`;
        output += `Volume1: ${value.volume1}\n`;
        output += `Liquidity: ${value.liquidity}\n`;
        output += `MarketCap: ${value.marketCap}\n`;
        output += `PriceUSD: ${value.priceUSD}\n`;
        output += `\n`;
        output += `Activity info:\n`;
        output += `Holders: ${value.holders}\n`;
        output += `buyCount1: ${value.buyCount1}\n`;
        output += `sellCount1: ${value.sellCount1}\n`;
        output += `txnCount1: ${value.txnCount1}\n`;
        output += `\n`;
        output += `Price fluctuation info:\n`;
        output += `change1: ${value.change1}\n`;
        output += `high1: ${value.high1}\n`;
        output += `low1: ${value.low1}\n`;
        output += `\n`;
        output += `Unique actions info:\n`;
        output += `uniqueBuys1: ${value.uniqueBuys1}\n`;
        output += `uniqueSells1: ${value.uniqueSells1}\n`;
        output += `uniqueTransactions1: ${value.uniqueTransactions1}\n`;
        output += `\n`;
        output += `Miscellaneous info:\n`;
        output += `Decimals: ${value.decimals}\n`;
        output += `Exchanges: ${value.exchanges.join(", ")}\n`;
        output += `NetworkId: ${value.networkId}\n`;
        output += `\n`;
      });

      // Write the output to a text file
      fs.writeFileSync(txtFilename, output);

      console.log(`Results written to ${txtFilename}`);
    })
    .catch((error) => {
      console.error(error);
    });
}

// Run the function immediately and then every 5 minutes
fetchAndSaveTokenResults();
setInterval(fetchAndSaveTokenResults, 300000); // 300000 milliseconds = 5 minutes