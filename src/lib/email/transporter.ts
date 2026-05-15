import nodemailer from "nodemailer";
// import { Resend } from 'resend';

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  console.warn("⚠️ SMTP_USER or SMTP_PASS is missing from environment variables.");
}

export const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  auth: {
    user,
    pass,
  },
});

/*
// Resend setup (Commented out)
export const resend = new Resend(process.env.RESEND_API_KEY);
*/

export const fromEmail = process.env.SMTP_FROM || (user ? `Meal Chart <${user}>` : "Meal Chart <noreply@example.com>");
