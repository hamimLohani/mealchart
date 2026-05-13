import nodemailer from "nodemailer";

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true, // Reuse connections
  maxConnections: 1, // Gmail is sensitive to concurrent connections
  maxMessages: 100, // Max messages per connection
  auth: {
    user,
    pass,
  },
});

export const fromEmail = process.env.SMTP_FROM || `Meal Chart <${user}>`;
