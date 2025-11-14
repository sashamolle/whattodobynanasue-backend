// Use require for Node.js backend
const nodemailer = require('nodemailer');
const cors = require('cors');

// Initialize the CORS middleware
// IMPORTANT: Update 'YOUR_WEBSITE_URL' to your live site
const allowedOrigins = [
    'https://sashamolle.github.io', // Your GitHub Pages URL
    'http://127.0.0.1:5500' // For local testing
];

const corsHandler = cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
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
    // We use a helper function to wrap middleware for Vercel
    await runMiddleware(req, res, corsHandler);

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        const { name, _replyto, interest, message } = req.body;

        // --- IMPORTANT: Email Configuration ---
        // You MUST set these as Environment Variables in Vercel
        // NEVER write your password directly in the code.
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const emailTo = process.env.EMAIL_TO; // This will be "sue@whattodobynanasue.com"

        if (!emailUser || !emailPass || !emailTo) {
            console.error('Missing environment variables for email');
            return res.status(500).json({ error: 'Server configuration error.' });
        }
        
        // 1. Create a "transporter"
        // This example uses Gmail. You can use other services.
        // If using Gmail, you MUST create an "App Password"
        // See: https://support.google.com/accounts/answer/185833
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser, // Your "sending" email (e.g., nanasue.website@gmail.com)
                pass: emailPass, // Your 16-character "App Password"
            },
        });

        // 2. Define the email options
        const mailOptions = {
            from: `"${name}" <${_replyto}>`, // Sender's name and email
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

        // 3. Send the email
        await transporter.sendMail(mailOptions);

        // 4. Send a success response
        // This is what the JavaScript on your contact.html page is waiting for
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