const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Same encryption setup as protect.js
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Load webhooks from storage
function loadWebhooks() {
    const webhooksFile = path.join(process.cwd(), 'data', 'webhooks.json');
    try {
        if (fs.existsSync(webhooksFile)) {
            const data = fs.readFileSync(webhooksFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading webhooks:', error);
    }
    return {};
}

function saveWebhooks(webhookStore) {
    const webhooksFile = path.join(process.cwd(), 'data', 'webhooks.json');
    try {
        const dir = path.dirname(webhooksFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(webhooksFile, JSON.stringify(webhookStore, null, 2));
    } catch (error) {
        console.error('Error saving webhooks:', error);
    }
}

export default async function handler(req, res) {
    const { id } = req.query;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        // Load webhooks from storage
        const webhookStore = loadWebhooks();

        // Find the webhook
        if (!webhookStore[id]) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        const webhookData = webhookStore[id];
        
        // Decrypt the original URL
        const originalUrl = decrypt(webhookData.originalUrl);

        // Update usage count
        webhookData.usageCount = (webhookData.usageCount || 0) + 1;
        webhookData.lastUsed = new Date().toISOString();
        
        // Save updated data
        saveWebhooks(webhookStore);

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
