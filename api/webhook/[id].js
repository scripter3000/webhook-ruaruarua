const crypto = require('crypto');

// Same encryption setup as protect.js
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(encryptedData) {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
        throw new Error('Invalid encryption key');
    }
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const ALGORITHM = 'aes-256-gcm';

// In-memory storage - shared across webhook calls
let webhookStore = {};

export default async function handler(req, res) {
    const { id } = req.query;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed', 
            message: 'This webhook only accepts POST requests'
        });
    }

    try {
        // Find the webhook in memory
        if (!webhookStore[id]) {
            return res.status(404).json({ 
                error: 'Webhook not found',
                message: 'This webhook may have expired or been reset'
            });
        }

        const webhookData = webhookStore[id];
        
        // Decrypt the original URL
        const originalUrl = decrypt(webhookData.originalUrl);

        // Update usage count
        webhookData.usageCount = (webhookData.usageCount || 0) + 1;
        webhookData.lastUsed = new Date().toISOString();

        // Forward the request to the original webhook
        const response = await fetch(originalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...req.headers
            },
            body: JSON.stringify(req.body)
        });

        // Forward the response
        const responseText = await response.text();
        
        return res.status(response.status).json({
            success: true,
            originalStatus: response.status,
            message: responseText || 'Request forwarded successfully',
            usage: webhookData.usageCount
        });

    } catch (error) {
        console.error('Error forwarding webhook:', error);
        return res.status(500).json({ 
            error: 'Failed to forward webhook',
            message: error.message 
        });
    }
}
