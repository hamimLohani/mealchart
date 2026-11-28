import nodemailer from "nodemailer";

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const service = process.env.SMTP_SERVICE || "gmail";
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT || "465");
const secure = process.env.SMTP_SECURE !== "false"; // Default to true if not "false"

if (!user || !pass) {
  console.warn("⚠️ SMTP_USER or SMTP_PASS is missing from environment variables.");
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const parsedPort = Number.parseInt(process.env.SMTP_PORT || "465", 10);
  const transportOptions = {
    host,
    port: Number.isFinite(parsedPort) ? parsedPort : port,
    secure,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    auth: {
      user,
      pass,
    },
    service,
  };

  cachedTransporter = nodemailer.createTransport(transportOptions);
  return cachedTransporter;
}

export const fromEmail = process.env.SMTP_FROM || (user ? `মিল চার্ট <${user}>` : "মিল চার্ট <noreply@example.com>");
