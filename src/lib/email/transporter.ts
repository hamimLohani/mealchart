import { Resend } from 'resend';

// Nodemailer setup (Commented out)
/*
import nodemailer from "nodemailer";
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
*/

// Resend setup
export const resend = new Resend(process.env.RESEND_API_KEY);

// When using Resend, you MUST use a verified domain. 
// If you haven't verified a domain yet, you can only send to yourself using 'onboarding@resend.dev'
export const fromEmail = process.env.SMTP_FROM || 'Meal Chart <onboarding@resend.dev>';
