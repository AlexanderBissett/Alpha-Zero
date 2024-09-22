const fs = require('fs');
const path = require('path');

// Path to the JSON file (assuming it's in the same directory)
const filePath = path.join(__dirname, 'addresses.json');

// Time threshold: 15 minutes in seconds
const TIME_THRESHOLD = 10 * 60; // 900 seconds

// Read the JSON file
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  try {
    // Parse the JSON data
    const addresses = JSON.parse(data);

    // Get current Unix timestamp (in seconds)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Filter out addresses that are not used and older than 15 minutes
    const filteredAddresses = addresses.filter(addr => {
      const timeElapsed = currentTimestamp - addr.scannedAt;
      return addr.used || timeElapsed <= TIME_THRESHOLD;
    });

    // Write the updated data back to the file
    fs.writeFile(filePath, JSON.stringify(filteredAddresses, null, 2), 'utf8', (err) => {
      if (err) {
        console.error('Error writing to the file:', err);
        return;
      }
      console.log('File updated successfully.');
    });
  } catch (parseErr) {
    console.error('Error parsing the JSON data:', parseErr);
  }
});