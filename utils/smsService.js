const https = require('https');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || '';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';
const WHATSAPP_SENDER = process.env.WHATSAPP_SENDER || '';

const sendWhatsAppMessage = async (phoneNumber, message) => {
  if (!phoneNumber) {
    console.error('WhatsApp Error: No phone number provided');
    return { success: false, error: 'No phone number provided' };
  }

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone}`;

  if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
    console.log('========== MOCK WhatsApp Message ==========');
    console.log(`To: +${formattedPhone}`);
    console.log(`Message: ${message}`);
    console.log('===========================================');
    return { success: true, data: { mock: true, to: formattedPhone, message } };
  }

  return sendViaWhatsAppAPI(formattedPhone, message);
};

const sendViaWhatsAppAPI = async (to, message) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      to: to,
      message: message
    });

    const options = {
      hostname: WHATSAPP_API_URL,
      port: 443,
      path: '/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ success: true, data: parsed });
        } catch (e) {
          resolve({ success: true, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      console.error('WhatsApp API Error:', error.message);
      resolve({ success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
};

const sendSMS = async (phoneNumber, message) => {
  return sendWhatsAppMessage(phoneNumber, message);
};

module.exports = { sendSMS, sendWhatsAppMessage };
