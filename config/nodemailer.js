// config/nodemailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify on load
transporter.verify((error) => {
  if (error) {
    console.log('Nodemailer config error:', error.message);
    console.log('Tip: Use Gmail App Password (16 chars) + 2FA enabled');
  } else {
    console.log('Nodemailer ready:', process.env.EMAIL_USER);
  }
});

module.exports = transporter;