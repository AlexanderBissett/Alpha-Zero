const fs = require('fs');
const path = require('path');

// Path to the Config.json file (relative to the current script)
const configFilePath = path.join(__dirname, '../Config.json');

// Read the Config.json file
fs.readFile(configFilePath, 'utf8', (err, configData) => {
  if (err) {
    console.error('Error reading the config file:', err);
    return;
  }

  try {
    // Parse the config data
    const config = JSON.parse(configData);

    // Extract the cleaner time and file path from the config
    const cleanerTimeMinutes = config.cleanerTimeMinutes || 10; // Default to 10 minutes if not specified
    const filePath = 'Workers/addresses.json'

    // Read the JSON file (specified in the config)
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

        // Filter addresses based on the specified criteria
        const filteredAddresses = addresses.filter(addr => {
          const timeElapsed = currentTimestamp - addr.scannedAt;
          const olderThanTenMinutes = timeElapsed > (cleanerTimeMinutes * 60); // 10 minutes in seconds

          // Keep addresses that do not meet the delete criteria
          return !((!addr.used && olderThanTenMinutes) || (addr.used && addr.balance === 0));
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
  } catch (parseErr) {
    console.error('Error parsing the config file:', parseErr);
  }
});