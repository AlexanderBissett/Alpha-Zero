import axios from "axios";

// Function to check if a token can be swapped on Raydium
async function checkTokenSwappable(tokenAddress) {
    try {
        const response = await axios.post(
            "https://graph.defined.fi/graphql",
            {
                // GraphQL query to check token
                query: `{
                    token(input: { address: "${tokenAddress}", networkId: 1399811149 }) {
                        address
                        exchanges {
                            name
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
        );

        const exchanges = response.data.data.token.exchanges;

        // Check if 'Raydium' is present in the exchanges array
        const isSwappable = exchanges.some(exchange => exchange.name.includes("Raydium"));

        if (isSwappable) {
            console.log(`Token ${tokenAddress} can be swapped on Raydium.`);
        } else {
            console.log(`Token ${tokenAddress} cannot be swapped on Raydium.`);
        }
    } catch (error) {
        console.error("Error checking token:", error);
    }
}

// Replace with your token address
const tokenAddressToCheck = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"; // Example token address
checkTokenSwappable(tokenAddressToCheck);