import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { to, subject, body } = req.body;
  
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn("Gmail SMTP has not been fully configured in environment variables.");
    return res.status(200).json({
      success: false,
      simulated: true,
      message: "Gmail SMTP environment credentials are not declared (SMTP_USER / SMTP_PASS). Emailed credentials printed safely to corporate admin modal.",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"ClockClock EAS" <${smtpUser}>`,
      to,
      subject,
      text: body,
    });

    console.log(`Email securely dispatched via Vercel Function: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Gmail SMTP Gateway Error: ", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unknown Gmail SMTP server failure.",
    });
  }
}
