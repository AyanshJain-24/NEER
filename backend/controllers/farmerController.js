const { dispatchAlert } = require('../services/notificationService');
const { evaluateBlockRisk } = require('../services/rulesEngine');
const mockForecasts = require('../data/mockForecasts.json');

// In-memory farmer register with Indian phone numbers and regional preferences
const farmers = [
  {
    id: 1,
    name: "Ramesh Pawar",
    phone: "+91 98220 12345",
    block_id: "MH_PUN_001",
    preferred_language: "mr"
  },
  {
    id: 2,
    name: "Suresh Shinde",
    phone: "+91 98221 23456",
    block_id: "MH_PUN_001",
    preferred_language: "hi"
  },
  {
    id: 3,
    name: "Dnyaneshwar More",
    phone: "+91 98224 56789",
    block_id: "MH_PUN_001",
    preferred_language: "mr"
  },
  {
    id: 4,
    name: "Santosh Jagtap",
    phone: "+91 98222 34567",
    block_id: "MH_PUN_002",
    preferred_language: "mr"
  },
  {
    id: 5,
    name: "Anil Kulkarni",
    phone: "+91 98223 45678",
    block_id: "MH_PUN_002",
    preferred_language: "hi"
  }
];

/**
 * Trigger SMS/WhatsApp alert dispatch for farmers in a given block,
 * supporting optional manual handset override (customPhone, customLang).
 */
exports.triggerBlockAlert = async (req, res) => {
  try {
    const { blockId } = req.params;
    const { customPhone, customLang } = req.body || {};

    const blockRaw = mockForecasts.find((f) => f.block_id === blockId);
    if (!blockRaw) {
      return res.status(404).json({ success: false, message: `Block '${blockId}' not found.` });
    }

    // Evaluate risk level
    const { risk_level, color_code } = evaluateBlockRisk(blockRaw);
    const block = {
      ...blockRaw,
      risk_level,
      color_code
    };

    // Primary crop advisory for this block
    const primaryAdvisory =
      block.advisories && block.advisories.length > 0 ? block.advisories[0] : null;

    // Determine target recipients: either customPhone override or registered block farmers
    let targetRecipients = [];
    if (customPhone && typeof customPhone === 'string' && customPhone.trim().length > 0) {
      targetRecipients = [
        {
          id: 9999,
          name: "Test User (Custom Handset)",
          phone: customPhone.trim(),
          preferred_language: customLang || "hi"
        }
      ];
    } else {
      targetRecipients = farmers.filter((f) => f.block_id === blockId);
      // Fallback if no farmers mapped to this block
      if (targetRecipients.length === 0 && process.env.TEST_RECIPIENT_PHONE) {
        targetRecipients = [
          {
            id: 9999,
            name: "Default Test Handset",
            phone: process.env.TEST_RECIPIENT_PHONE,
            preferred_language: customLang || "hi"
          }
        ];
      }
    }

    const dispatched = [];
    for (const farmer of targetRecipients) {
      const activeLang = customLang || farmer.preferred_language || 'hi';
      const alertResult = await dispatchAlert(farmer, block, primaryAdvisory, activeLang);
      dispatched.push(alertResult);
    }

    return res.status(200).json({
      success: true,
      block_id: blockId,
      block_name: block.block_name,
      risk_level: block.risk_level,
      dispatched_count: dispatched.length,
      total_dispatched: dispatched.length,
      mode: dispatched[0]?.mode || 'console_fallback',
      delivery_statuses: dispatched.map((d) => ({
        recipient: d.recipient,
        phone: d.phone,
        whatsapp_to: d.whatsapp_to,
        status: d.status,
        message_sid: d.message_sid,
        mode: d.mode
      })),
      recipients: dispatched
    });
  } catch (error) {
    console.error('[ERROR in triggerBlockAlert]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process alert dispatch',
      error: error.message
    });
  }
};