// Use require for Node.js backend
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });
const { json } = require('micro'); // <-- FIX 1: Import the JSON parser

// Initialize the CORS middleware
// ... (Your allowedOrigins list is fine) ...
const allowedOrigins = [
    'https://sashamolle.github.io', // Your GitHub Pages URL
    'http://127.0.0.1:5500', // For local testing
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'null'
];

const corsHandler = cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
});

// This is the main function Vercel will run
export default async function handler(req, res) {
    // Run the CORS middleware
    await runMiddleware(req, res, corsHandler);

    // --- FIX 2: Handle the browser's "preflight" OPTIONS request ---
    // This stops a confusing error *before* the POST request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        // --- FIX 3: Manually parse the JSON body ---
        // This reads the data your frontend is sending
        const body = await json(req);

        // Now, we get the data from `body`, NOT `req.body`
        const { name, _replyto, interest, message } = body;

        // --- IMPORTANT: Email Configuration ---
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const emailTo = process.env.EMAIL_TO;

        // Your console logs will now work!
        console.log("Received name:", name);
        console.log("Received message:", message);
        console.log("Received interest:", interest);
        console.log("Received replyTo:", _replyto);

        if (!emailUser || !emailPass || !emailTo) {
            console.error('Missing environment variables for email');
            return res.status(500).json({ error: 'Server configuration error.' });
        }
        
        // 1. Create a "transporter"
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        // 2. Define the email options (for Nana Sue)
        const mailOptions = {
            from: `"${name}" <${emailUser}>`, // Use your "robot" email as the sender
            to: emailTo, // Nana Sue's email
            replyTo: _replyto, // The user's email
            subject: `New Message from ${name} via Website (${interest})`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${_replyto}</p>
                    <p><strong>Interested In:</strong> ${interest}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap;">${message}</p>
                </div>
            `,
        };

        // 3. Send the email to Nana Sue
        await transporter.sendMail(mailOptions);

        // --- 4. NEW: Define the auto-responder email (for the user) ---
        const autoResponderOptions = {
            from: `"Dr. Sue Weber (Nana Sue)" <${emailTo}>`, // From Nana Sue
            to: _replyto, // Send to the user who submitted the form
            subject: "Thanks for your message!",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h3>Hi ${name},</h3>
                    <p>Thanks for getting in touch! Your message has been received, and I'll get back to you as soon as possible.</p>
                    <br>
                    <p>Warmly,</p>
                    <p>Dr. Sue (Nana Sue)</p>
                    <p><em>What To Do by Nana Sue</em></p>
                </div>
            `
        };

        // --- 5. NEW: Send the auto-responder email ---
        await transporter.sendMail(autoResponderOptions);

        // 6. Send a success response
        res.status(200).json({ message: 'Message sent successfully!' });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send message. ' + error.message });
    }
}

// Helper function to run middleware in Vercel
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}