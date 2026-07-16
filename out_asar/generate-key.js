const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');

function getLocalHardwareId() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('powershell.exe -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"');
      return output.toString().trim();
    } else if (process.platform === 'linux') {
      if (fs.existsSync('/etc/machine-id')) {
        return fs.readFileSync('/etc/machine-id', 'utf8').trim();
      } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
        return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
      }
    } else if (process.platform === 'darwin') {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice | awk \'/IOPlatformUUID/ { split($0, line, "\\""); printf("%s\\n", line[4]); }\'');
      return output.toString().trim();
    }
    return 'UNKNOWN-PLATFORM-ID';
  } catch (err) {
    console.error('Failed to get hardware ID:', err);
    return 'UNKNOWN-HARDWARE-ID';
  }
}

// Check if a hardware ID was provided via command line arguments
let targetHardwareId = process.argv[2];

if (!targetHardwareId) {
  console.log("No Hardware ID provided. Generating key for THIS local machine...");
  targetHardwareId = getLocalHardwareId();
} else {
  console.log("Generating key for CLIENT's Machine ID: " + targetHardwareId);
}

const secretSalt = "BillingPosSecretKey2026!";
const licenseKey = crypto.createHash('sha256').update(targetHardwareId + secretSalt).digest('hex');

console.log("=========================================");
console.log("🔑 Generated License Key: ");
console.log(licenseKey);
console.log("=========================================");
console.log("\nIf this is for a client, send them this key and tell them to");
console.log("save it inside a 'license.key' file in their AppData folder.");
