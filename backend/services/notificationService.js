/**
 * Monsoon Advisory Platform - Live WhatsApp Notification Service (Twilio Gateway)
 */
require('dotenv').config();
const twilio = require('twilio');

// Replace hardcoded strings like 'ACxxxxxxxx...' with environment variables:
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'your_twilio_account_sid_here';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'your_twilio_auth_token_here';
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const REGISTERED_CONTENT_SID = 'HXfe5ab5f00277942d4d4200328b4d403c';

function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  let clean = phone.replace(/^whatsapp:/i, '').trim();
  clean = clean.replace(/[\s\-\(\)]/g, '');
  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = `+91${clean}`;
    } else {
      clean = `+${clean}`;
    }
  }
  return `whatsapp:${clean}`;
}

const twilioClient = twilio(accountSid, authToken);
console.log('[GATEWAY] Twilio WhatsApp Client initialized with pre-approved template pipeline.');

async function dispatchAlert(farmer, block, advisory, overrideLang) {
  const preferredLang = overrideLang || farmer?.preferred_language || 'hi';
  const blockName = block?.block_name || block?.block_id || 'Haveli';
  const riskTier = (block?.risk_level || 'LOW').toUpperCase();
  const cropStage = advisory?.crop
    ? `${advisory.crop} (${advisory.stage || 'General'})`
    : 'Soybean';

  const regionalText =
    advisory?.regional_text?.[preferredLang] ||
    advisory?.regional_text?.['hi'] ||
    advisory?.action ||
    'Ensure field drainage.';

  const rawPhone = farmer?.phone || process.env.TEST_RECIPIENT_PHONE || '+918619531837';
  const formattedTo = formatWhatsAppNumber(rawPhone);
  const formattedFrom = formatWhatsAppNumber(twilioWhatsAppNumber);

  // Slot 1: Location, Severity, Crop
  const slot1 = `${blockName} [${riskTier} RISK | ${cropStage}]`;

  // Slot 2: Regional Advisory Advice (Hindi or Marathi)
  const slot2 = `${regionalText} (Issued: ${new Date().toLocaleTimeString('en-IN')})`;

  console.log(`[DISPATCHING TEMPLATE ALERT] Target: ${formattedTo}`);

  try {
    const templateMsg = await twilioClient.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid: REGISTERED_CONTENT_SID,
      contentVariables: JSON.stringify({
        '1': slot1,
        '2': slot2
      })
    });

    console.log(`[LIVE TWILIO SUCCESS - TEMPLATE] SID: ${templateMsg.sid} | Status: ${templateMsg.status}`);

    return {
      success: true,
      mode: 'twilio_live_template',
      message_sid: templateMsg.sid,
      status: templateMsg.status,
      recipient: farmer?.name || 'Farmer',
      phone: rawPhone,
      whatsapp_to: formattedTo,
      block_name: blockName,
      risk_level: riskTier,
      regional_text: regionalText
    };
  } catch (err) {
    console.error(`[DISPATCH ERROR]: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  dispatchAlert,
  formatWhatsAppNumber
};