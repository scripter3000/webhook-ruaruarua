document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('protectForm');
    const resultDiv = document.getElementById('result');
    const protectedUrlInput = document.getElementById('protectedUrl');
    const copyBtn = document.getElementById('copyBtn');
    const newWebhookBtn = document.getElementById('newWebhook');
    const protectBtn = document.getElementById('protectBtn');
    const btnText = document.getElementById('btnText');
    const loading = document.getElementById('loading');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const webhookUrl = document.getElementById('webhookUrl').value.trim();
        
        if (!webhookUrl) {
            alert('Please enter a webhook URL');
            return;
        }

        // Show loading state
        protectBtn.disabled = true;
        btnText.classList.add('hidden');
        loading.classList.remove('hidden');

        try {
            const response = await fetch('/api/protect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ webhookUrl })
            });

            let data;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error('Server returned non-JSON response: ' + text.substring(0, 100));
            }

            if (response.ok) {
                protectedUrlInput.value = data.protectedUrl;
                resultDiv.classList.remove('hidden');
                form.parentElement.classList.add('hidden');
            } else {
                throw new Error(data.error || 'Failed to protect webhook');
            }
        } catch (error) {
            console.error('Full error:', error);
            alert('Error: ' + error.message);
        } finally {
            // Reset button state
            protectBtn.disabled = false;
            btnText.classList.remove('hidden');
            loading.classList.add('hidden');
        }
    });

    copyBtn.addEventListener('click', async function() {
        try {
            await navigator.clipboard.writeText(protectedUrlInput.value);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (error) {
            // Fallback for older browsers
            protectedUrlInput.select();
            document.execCommand('copy');
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
            }, 2000);
        }
    });

    newWebhookBtn.addEventListener('click', function() {
        form.parentElement.classList.remove('hidden');
        resultDiv.classList.add('hidden');
        document.getElementById('webhookUrl').value = '';
    });
});
