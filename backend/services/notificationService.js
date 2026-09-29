
/**
 * NEER - WhatsApp Notification Service
 *
 * Supports two modes:
 * 1. Twilio WhatsApp messaging when valid credentials are configured.
 * 2. Console simulation when Twilio credentials are unavailable.
 *
 * Simulated notifications are NOT sent to real recipients.
 */

require('dotenv').config();

const twilio = require('twilio');

// Read credentials from environment variables.
// Never hardcode account credentials in this file.
const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';

const fromWhatsAppNumber =
  process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const REGISTERED_CONTENT_SID =
  process.env.TWILIO_CONTENT_SID || 'HXfe5ab5f00277942d4d4200328b4d403c';

// Only initialize Twilio when the Account SID and token look configured.
const twilioEnabled = process.env.TWILIO_ENABLED === 'true';

const hasTwilioCredentials =
  twilioEnabled &&
  /^AC[a-f0-9]{32}$/i.test(accountSid) &&
  authToken.trim().length > 0 &&
  !authToken.toLowerCase().includes('your_twilio');

const twilioClient = hasTwilioCredentials
  ? twilio(accountSid, authToken)
  : null;

console.log(
  twilioClient
    ? '[GATEWAY] Twilio WhatsApp messaging is configured.'
    : '[GATEWAY] Twilio is not configured. Using simulated notifications.'
);

/**
 * Normalize an Indian phone number or an international phone number
 * into Twilio's WhatsApp address format.
 */
function formatWhatsAppNumber(phone) {
  if (phone === null || phone === undefined || phone === '') {
    return null;
  }

  let clean = String(phone).trim();

  clean = clean.replace(/^whatsapp:/i, '');
  clean = clean.replace(/[\s\-()]/g, '');

  if (!clean) {
    return null;
  }

  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = `+91${clean}`;
    } else {
      clean = `+${clean}`;
    }
  }

  return `whatsapp:${clean}`;
}

/**
 * Send a WhatsApp advisory when Twilio is configured.
 * Otherwise, return a clearly labelled simulated result.
 */
async function dispatchAlert(farmer, block, advisory, overrideLang) {
  const preferredLang =
    overrideLang || farmer?.preferred_language || 'hi';

  const blockName =
    block?.block_name || block?.block_id || 'Unknown Block';

  const riskTier =
    (block?.risk_level || 'LOW').toUpperCase();

  const cropStage = advisory?.crop
    ? `${advisory.crop} (${advisory.stage || 'General'})`
    : 'Soybean';

  const regionalText =
    advisory?.regional_text?.[preferredLang] ||
    advisory?.regional_text?.hi ||
    advisory?.action ||
    'Ensure field drainage.';

  // Do not use a hardcoded personal phone number as a fallback.
  const rawPhone =
    farmer?.phone || process.env.TEST_RECIPIENT_PHONE || null;

  const formattedTo = formatWhatsAppNumber(rawPhone);
  const formattedFrom = formatWhatsAppNumber(fromWhatsAppNumber);

  const resultDetails = {
    recipient: farmer?.name || 'Farmer',
    block_name: blockName,
    risk_level: riskTier,
    regional_text: regionalText
  };

  // No valid Twilio credentials: log a simulation, not a real delivery.
  if (!twilioClient) {
    console.log(
      `[SIMULATED ALERT] ${blockName} | ${riskTier} RISK | ${regionalText}`
    );

    return {
      success: true,
      mode: 'console_fallback',
      status: 'simulated_not_sent',
      ...resultDetails
    };
  }

  // Real delivery requires a configured recipient.
  if (!formattedTo) {
    console.warn(
      `[DISPATCH SKIPPED] No recipient phone number configured for ${resultDetails.recipient}.`
    );

    return {
      success: false,
      mode: 'twilio_live_template',
      status: 'not_sent',
      error: 'No recipient phone number is configured.',
      ...resultDetails
    };
  }

  if (!formattedFrom) {
    return {
      success: false,
      mode: 'twilio_live_template',
      status: 'not_sent',
      error: 'Twilio WhatsApp sender number is missing.',
      ...resultDetails
    };
  }

  const slot1 = `${blockName} [${riskTier} RISK | ${cropStage}]`;

  const slot2 =
    `${regionalText} (Issued: ${new Date().toLocaleTimeString('en-IN')})`;

  console.log(`[DISPATCHING WHATSAPP ALERT] Target: ${formattedTo}`);

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

    console.log(
      `[TWILIO RESPONSE] SID: ${templateMsg.sid} | Status: ${templateMsg.status}`
    );

    return {
      success: true,
      mode: 'twilio_live_template',
      message_sid: templateMsg.sid,
      status: templateMsg.status,
      phone: rawPhone,
      whatsapp_to: formattedTo,
      ...resultDetails
    };
  } catch (err) {
    console.error(`[DISPATCH ERROR] ${err.message}`);

    return {
      success: false,
      mode: 'twilio_live_template',
      status: 'failed',
      error: err.message,
      ...resultDetails
    };
  }
}

module.exports = {
  dispatchAlert,
  formatWhatsAppNumber
};