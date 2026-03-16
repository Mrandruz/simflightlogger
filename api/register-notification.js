export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, displayName, uid } = req.body;

    // IMPORTANT: This requires RESEND_API_KEY environment variable in Vercel
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured. Registration notification skipped.');
        return res.status(200).json({ message: 'Notification skipped (missing API Key)' });
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'SimFlight Logger <notifications@simflightlogger.vercel.app>',
                to: ['and977@gmail.com'],
                subject: 'New Pilot Registration Request',
                html: `
                    <h1>New Registration Request</h1>
                    <p>A new user has registered and is waiting for approval:</p>
                    <ul>
                        <li><strong>Name:</strong> ${displayName}</li>
                        <li><strong>Email:</strong> ${email}</li>
                        <li><strong>UID:</strong> ${uid}</li>
                    </ul>
                    <p>Log in to the SimFlight Logger Admin Panel to approve or reject this request.</p>
                `,
            }),
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            const error = await response.json();
            console.error('Resend error:', error);
            return res.status(500).json({ error: 'Failed to send notification' });
        }
    } catch (error) {
        console.error('Notification proxy error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
