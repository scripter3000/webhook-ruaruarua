const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Simple encryption using AES-256-GCM
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be set in Vercel environment variables

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY environment variable must be exactly 32 characters');
}
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// In-memory storage for this example (use a database in production)
let webhookStore = {};

// Try to load existing webhooks from file
const webhooksFile = path.join(process.cwd(), 'data', 'webhooks.json');

try {
    if (fs.existsSync(webhooksFile)) {
        const data = fs.readFileSync(webhooksFile, 'utf8');
        webhookStore = JSON.parse(data);
    }
} catch (error) {
    console.log('No existing webhooks file found, starting fresh');
}

function saveWebhooks() {
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
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set content type to JSON
    res.setHeader('Content-Type', 'application/json');

    try {
        const { webhookUrl } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({ error: 'Webhook URL is required' });
        }

        // Validate URL format
        try {
            new URL(webhookUrl);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Generate a unique ID for this webhook
        const webhookId = crypto.randomBytes(16).toString('hex');
        
        // Store the webhook with encryption
        webhookStore[webhookId] = {
            originalUrl: encrypt(webhookUrl),
            createdAt: new Date().toISOString(),
            usageCount: 0
        };

        // Save to file
        saveWebhooks();

        // Generate the protected URL
        const baseUrl = `https://${req.headers.host}`;
        const protectedUrl = `${baseUrl}/api/webhook/${webhookId}`;

        return res.status(200).json({
            success: true,
            protectedUrl,
            webhookId
        });

    } catch (error) {
        console.error('Error protecting webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
