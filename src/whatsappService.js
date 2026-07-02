// ═══════════════════════════════════════════════════════════════════════════
//  WhatsApp Service (MSG91 Integration)
//  Handles sending automated receipts and custom updates via MSG91 WhatsApp API
// ═══════════════════════════════════════════════════════════════════════════

// --- ⚙️ CONFIGURATION ⚙️ ---
// Replace these placeholders with your actual MSG91 details.
const MSG91_AUTH_KEY = "YOUR_MSG91_AUTH_KEY_HERE";
const SENDER_NUMBER = "YOUR_REGISTERED_SENDER_NUMBER"; // e.g., "919876543210"
const RECEIPT_TEMPLATE_NAME = "receipt_template_name_here";
const UPDATE_TEMPLATE_NAME = "update_template_name_here";
// -----------------------------

const MSG91_API_URL = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/";

/**
 * Format phone number to ensure it has the country code (assuming India 91 by default)
 */
function formatPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Send a WhatsApp receipt after checkout
 * @param {string} phone - Customer's 10-digit phone number
 * @param {string} customerName - Customer's name (or empty string)
 * @param {number} amountPaise - The grand total in paise
 * @param {string} receiptNumber - The invoice number
 */
async function sendWhatsAppReceipt(phone, customerName, amountPaise, receiptNumber) {
  if (!phone || MSG91_AUTH_KEY === "YOUR_MSG91_AUTH_KEY_HERE") {
    console.log("⚠️ WhatsApp Receipt Skipped: API keys not configured or phone missing.");
    return;
  }

  const formattedPhone = formatPhone(phone);
  const amountRupees = (amountPaise / 100).toFixed(2);
  const name = customerName || "Customer";

  const payload = {
    integrated_number: SENDER_NUMBER,
    content_type: "template",
    payload: {
      to: formattedPhone,
      type: "template",
      template: {
        name: RECEIPT_TEMPLATE_NAME,
        language: { code: "en", policy: "deterministic" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: amountRupees },
              { type: "text", text: receiptNumber }
            ]
          }
        ]
      },
      messaging_product: "whatsapp"
    }
  };

  try {
    const response = await fetch(MSG91_API_URL, {
      method: "POST",
      headers: {
        "authkey": MSG91_AUTH_KEY,
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("🟢 MSG91 Receipt Response:", result);
  } catch (error) {
    console.error("🔴 MSG91 Receipt Error:", error);
  }
}

/**
 * Send a custom WhatsApp update to a customer
 * @param {string} phone - Customer's phone number
 * @param {string} customerName - Customer's name
 * @param {string} messageText - The custom update text
 */
async function sendWhatsAppUpdate(phone, customerName, messageText) {
  if (!phone || MSG91_AUTH_KEY === "YOUR_MSG91_AUTH_KEY_HERE") {
    return { success: false, error: "API keys not configured." };
  }

  const formattedPhone = formatPhone(phone);
  const name = customerName || "Customer";

  const payload = {
    integrated_number: SENDER_NUMBER,
    content_type: "template",
    payload: {
      to: formattedPhone,
      type: "template",
      template: {
        name: UPDATE_TEMPLATE_NAME,
        language: { code: "en", policy: "deterministic" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: name },
              { type: "text", text: messageText }
            ]
          }
        ]
      },
      messaging_product: "whatsapp"
    }
  };

  try {
    const response = await fetch(MSG91_API_URL, {
      method: "POST",
      headers: {
        "authkey": MSG91_AUTH_KEY,
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("🟢 MSG91 Update Response:", result);
    return { success: true, response: result };
  } catch (error) {
    console.error("🔴 MSG91 Update Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a custom WhatsApp update to MULTIPLE customers at once (Bulk)
 * @param {Array} recipients - Array of objects: [{ phone: '...', name: '...' }]
 * @param {string} messageText - The custom update text for everyone
 */
async function sendWhatsAppBulkUpdate(recipients, messageText) {
  if (!recipients || recipients.length === 0 || MSG91_AUTH_KEY === "YOUR_MSG91_AUTH_KEY_HERE") {
    return { success: false, error: "No recipients or API keys not configured." };
  }

  // Construct the bulk payload where 'to' is an array of objects containing individual variables
  const payload = {
    integrated_number: SENDER_NUMBER,
    content_type: "template",
    payload: {
      type: "template",
      template: {
        name: UPDATE_TEMPLATE_NAME,
        language: { code: "en", policy: "deterministic" }
      },
      messaging_product: "whatsapp",
      to: recipients.map(r => ({
        to: formatPhone(r.phone),
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: r.name || "Customer" },
              { type: "text", text: messageText }
            ]
          }
        ]
      }))
    }
  };

  try {
    // Note: If MSG91 requires the '/bulk/' endpoint, you may need to append 'bulk/' to MSG91_API_URL
    const response = await fetch(MSG91_API_URL + "bulk/", {
      method: "POST",
      headers: {
        "authkey": MSG91_AUTH_KEY,
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("🟢 MSG91 Bulk Update Response:", result);
    return { success: true, response: result };
  } catch (error) {
    console.error("🔴 MSG91 Bulk Update Error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendWhatsAppReceipt,
  sendWhatsAppUpdate,
  sendWhatsAppBulkUpdate
};
