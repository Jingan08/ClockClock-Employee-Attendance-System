import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending emails via Gmail SMTP
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body } = req.body;
    
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.warn("Gmail SMTP has not been fully configured in environment variables. Falling back to terminal display.");
      return res.status(200).json({
        success: false,
        simulated: true,
        message: "Gmail SMTP environment credentials are not declared (SMTP_USER / SMTP_PASS). Emailed credentials printed safely to corporate admin modal.",
      });
    }

    try {
      // In Gmail SMTP securely on SSL/TLS
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

      console.log(`Email securely dispatched via Gmail SMTP: ${info.messageId}`);
      return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Gmail SMTP Gateway Error: ", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Unknown Gmail SMTP server failure.",
      });
    }
  });

  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
