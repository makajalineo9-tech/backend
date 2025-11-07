// utils/email.js
const transporter = require('../config/nodemailer');

const sendVerificationEmail = async (email, link, name, role) => {
  const roleText = { student: 'Student', institute: 'Institution', company: 'Company' }[role] || role;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee;">
      <div style="background: #000; color: white; padding: 30px; text-align: center;">
        <h1>CareerGuide LESOTHO</h1>
        <p>Email Verification Required</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
        <h2>Welcome, ${name}!</h2>
        <p>You registered as a <strong>${roleText}</strong>.</p>
        <p>Click below to verify your email:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${link}" style="background: #000; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy: <code style="background: #eee; padding: 10px; font-size: 12px; word-break: break-all;">${link}</code></p>
        <p><strong>Expires in 24 hours.</strong></p>
      </div>
      <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
        &copy; ${new Date().getFullYear()} CareerGuide LESOTHO
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"CareerGuide LESOTHO" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - CareerGuide LESOTHO',
      html,
    });
    console.log(`Email sent to ${email}: ${info.messageId}`);
    return { success: true };
  } catch (err) {
    console.error(`Email failed to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendVerificationEmail };