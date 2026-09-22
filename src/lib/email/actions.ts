"use server";

import { transporter, fromEmail } from "./transporter";
import type { SendMailOptions } from "nodemailer";
import { getMonthTotals, getMemberTotals, formatMeal } from "@/lib/utils/meal-money";
import type { CostEntry, DepositEntry, MealEntry, Member } from "@/types/domain";
import dns from "dns";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown email error";
}

function buildMealChartTable(member: Member, meals: MealEntry[]) {
  const memberMeals = meals
    .filter((meal) => meal.memberId.toLowerCase() === member.id.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date));

  if (memberMeals.length === 0) {
    return `<p style="margin: 0; color: #64748b;">এই সময়ে এই সদস্যের কোনো মিল রেকর্ড করা হয়নি।</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">তারিখ</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">মিল সংখ্যা</th>
        </tr>
      </thead>
      <tbody>
        ${memberMeals
      .map(
        (meal) => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">${escapeHtml(meal.date)}</td>
                <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">${formatMeal(meal.quantity)}</td>
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
  `;
}

function buildCostBreakdown(costs: CostEntry[]) {
  if (costs.length === 0) {
    return `<p style="margin: 0; color: #64748b;">এই সময়ে কোনো খরচের এন্ট্রি রেকর্ড করা হয়নি।</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">আইটেম</th>
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">তারিখ</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">পরিমাণ (টাকা)</th>
        </tr>
      </thead>
      <tbody>
        ${costs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (cost) => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">${escapeHtml(cost.itemName)}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">${escapeHtml(cost.date)}</td>
                <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">${cost.amount.toFixed(2)} টাকা</td>
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
  `;
}

function buildDepositSummary(member: Member, deposits: DepositEntry[]) {
  const memberDeposits = deposits
    .filter((deposit) => deposit.memberId.toLowerCase() === member.id.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date));

  if (memberDeposits.length === 0) {
    return `<p style="margin: 0; color: #64748b;">এই সময়ে এই সদস্যের কোনো জমা টাকা রেকর্ড করা হয়নি।</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">তারিখ</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">জমা টাকা</th>
        </tr>
      </thead>
      <tbody>
        ${memberDeposits
      .map(
        (deposit) => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">${escapeHtml(deposit.date)}</td>
                <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">${deposit.amount.toFixed(2)} টাকা</td>
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
  `;
}

export async function sendWelcomeEmail(memberEmail: string, fullName: string, groupName: string) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <h1 style="color: #6366f1; font-size: 24px; text-align: center; margin-bottom: 20px;">${escapeHtml(groupName)}-এ স্বাগতম!</h1>
        <p style="font-size: 16px; line-height: 1.6;">প্রিয় <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">আমাদের গ্রুপে আপনাকে স্বাগতম। আপনার মিল অ্যাকাউন্ট সফলভাবে তৈরি করা হয়েছে।</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 14px; color: #666;">গ্রুপের নাম:</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${escapeHtml(groupName)}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">এখন আপনি আমাদের অ্যাপের মাধ্যমে আপনার মিল, জমা এবং মাসিক খরচের হিসাব দেখতে পারবেন।</p>
        <p style="text-align: center; margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">ড্যাশবোর্ডে যান</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">এটি মিল চার্ট থেকে পাঠানো একটি স্বয়ংক্রিয় ইমেইল। দয়া করে উত্তর দেবেন না।</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `স্বাগতম ${groupName} গ্রুপে! - মিল চার্ট`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Verifies if an email address "exists" by checking its domain's MX records.
 * This ensures the domain is real and configured to receive emails.
 */
export async function verifyEmailExistence(email: string) {
  if (!email || !email.includes("@")) return { exists: false, error: "Invalid email format" };
  
  const domain = email.split("@")[1];
  
  try {
    // Check if domain has MX records (mail servers)
    const mxRecords = await dns.promises.resolveMx(domain);
    
    if (mxRecords && mxRecords.length > 0) {
      // Check for "Null MX" (RFC 7505) which means the domain does not accept email
      // A Null MX is a single record with priority 0 and exchange "."
      const isNullMx = mxRecords.length === 1 && 
                       (mxRecords[0].exchange === "." || mxRecords[0].exchange === "");
      
      if (isNullMx) {
        return { exists: false, error: "This domain explicitly states it does not accept email." };
      }
      
      return { exists: true };
    }

    return { exists: false, error: "Domain has no mail servers (MX records) configured" };
  } catch (error: unknown) {
    const isNotFoundError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ((error as { code?: unknown }).code === "ENOTFOUND" ||
        (error as { code?: unknown }).code === "ENODATA");

    if (isNotFoundError) {
      return { exists: false, error: "The email domain does not exist." };
    }

    console.error(`Email verification failed for ${email}:`, error);
    return { exists: false, error: "Could not verify email domain." };
  }
}

export async function sendRemovalEmail(memberEmail: string, fullName: string, groupName: string) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <h1 style="color: #ef4444; font-size: 24px; text-align: center; margin-bottom: 20px;">অ্যাকাউন্ট সরানো হয়েছে</h1>
        <p style="font-size: 16px; line-height: 1.6;">প্রিয় <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">অ্যাডমিনের মাধ্যমে <strong>${escapeHtml(groupName)}</strong> গ্রুপ থেকে আপনার সদস্য অ্যাকাউন্টটি সরানো হয়েছে।</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 14px; color: #666;">গ্রুপের নাম:</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${escapeHtml(groupName)}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">যদি আপনি মনে করেন এটি ভুলবশত হয়েছে, তবে আপনার গ্রুপ অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">এটি মিল চার্ট থেকে পাঠানো একটি স্বয়ংক্রিয় ইমেইল। দয়া করে উত্তর দেবেন না।</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `অ্যাকাউন্ট বাতিল - ${groupName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send removal email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendAdminRemovalEmail(adminEmail: string, adminName: string, groupName: string) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 36px;">🛡️</span>
          <h1 style="color: #e11d48; font-size: 22px; margin: 10px 0 0 0; font-weight: bold;">অস্থায়ী অ্যাডমিন পদ প্রত্যাহার</h1>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">${escapeHtml(groupName)}</p>
        </div>

        <p style="font-size: 16px; line-height: 1.6;">প্রিয় <strong>${escapeHtml(adminName)}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">
          <strong>${escapeHtml(groupName)}</strong> গ্রুপের অ্যাডমিন দ্বারা আপনার <strong>&ldquo;অস্থায়ী অ্যাডমিন&rdquo;</strong> পদ ও প্রশাসনিক সুবিধাসমূহ সফলভাবে প্রত্যাহার করা হয়েছে।
        </p>

        <div style="background-color: #fff; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e11d48; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 13px; color: #64748b;">গ্রুপের নাম:</p>
          <p style="margin: 3px 0 10px 0; font-size: 16px; font-weight: bold; color: #1e293b;">${escapeHtml(groupName)}</p>

          <p style="margin: 0; font-size: 13px; color: #64748b;">বর্তমান স্ট্যাটাস:</p>
          <p style="margin: 3px 0 0 0; font-size: 14px; font-weight: 600; color: #e11d48;">অ্যাডমিন অ্যাক্সেস নিষ্ক্রিয় (সাধারণ সদস্য)</p>
        </div>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
            💡 <strong>মনে রাখুন:</strong> আপনি যদি এই গ্রুপের সদস্য হয়ে থাকেন, তবে আপনার পূর্ববর্তী মিল, বাজার খরচ ও জমা টাকার সমস্ত ব্যক্তিগত হিসাব অপরিবর্তিত রয়েছে। আপনি পূর্বের মতোই সাধারণ সদস্য হিসেবে আপনার হিসাব দেখতে পারবেন।
          </p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
          যদি আপনি মনে করেন এটি ভুলবশত হয়েছে, তবে অনুগ্রহ করে আপনার গ্রুপের মূল অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>

        <p style="text-align: center; margin-top: 25px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            মিল চার্ট ড্যাশবোর্ডে যান
          </a>
        </p>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">এটি মিল চার্ট থেকে পাঠানো একটি স্বয়ংক্রিয় ইমেইল। দয়া করে উত্তর দেবেন না।</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject: `[মিল চার্ট] অস্থায়ী অ্যাডমিন পদ প্রত্যাহার - ${groupName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send admin removal email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendAdminWelcomeEmail(adminEmail: string, adminName: string, groupName: string) {
  try {
    const html = `
      <div style="font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0f172a; color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <div style="padding: 40px 40px 20px 40px; text-align: center;">
            <div style="display: inline-block; padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 16px; margin-bottom: 20px;">
              <span style="font-size: 32px;">🚀</span>
            </div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">স্বাগতম, অ্যাডমিন!</h1>
            <p style="margin-top: 10px; color: #94a3b8; font-size: 16px;"><strong>${escapeHtml(groupName)}</strong> গ্রুপের জন্য আপনার ওয়ার্কস্পেস প্রস্তুত।</p>
          </div>

          <!-- Content -->
          <div style="padding: 0 40px 40px 40px;">
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">প্রিয় ${escapeHtml(adminName)},</p>
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">গ্রুপ সফলভাবে তৈরি করার জন্য অভিনন্দন। আপনার গ্রুপের সকল মিল ও খরচের হিসাব এখন আপনার পূর্ণ নিয়ন্ত্রণে। সহজে শুরু করার কিছু গুরুত্বপূর্ণ ধাপ:</p>

            <div style="margin: 30px 0; background: rgba(30, 41, 59, 0.5); border-radius: 16px; padding: 25px; border: 1px solid #334155;">
              <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #818cf8;">গ্রুপ পরিচালনার চেকলিস্ট</h3>
              
              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">👥</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">সদস্য যোগ করুন</strong>
                  <span style="font-size: 13px; color: #94a3b8;">"অ্যাডমিন মেম্বার্স" পেজে গিয়ে সদস্য যোগ করুন অথবা তাদের যুক্ত হওয়ার জন্য গ্রুপ ইনভাইট কোড শেয়ার করুন।</span>
                </div>
              </div>

              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">📊</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">মাসিক চার্ট তৈরি করুন</strong>
                  <span style="font-size: 13px; color: #94a3b8;">প্রতি মাসের শুরুতে একটি নতুন চার্ট তৈরি করে মিল এবং জমা এন্ট্রি করা শুরু করুন।</span>
                </div>
              </div>

              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">💸</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">খরচ ও জমা পরিচালনা</strong>
                  <span style="font-size: 13px; color: #94a3b8;">বাজার খরচ ও সদস্যদের জমা এন্ট্রি করুন। প্রতিটি জমার জন্য সদস্যরা সাথে সাথে ইমেইল রিসিট পাবেন।</span>
                </div>
              </div>

              <div style="display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">🔒</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">লক ও ফাইনাল হিসাব</strong>
                  <span style="font-size: 13px; color: #94a3b8;">মাস শেষে চার্টটি লক করুন। সিস্টেম স্বয়ংক্রিয়ভাবে মিল রেট ও ব্যালেন্স হিসাব করে সবাইকে পূর্ণ রিপোর্ট ইমেইল পাঠাবে।</span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" 
                 style="background: linear-gradient(to right, #6366f1, #a855f7); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);">
                অ্যাডমিন প্যানেলে যান
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 40px; background: rgba(15, 23, 42, 0.5); border-top: 1px solid #334155; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">সহায়তা প্রয়োজন? এই ইমেইলে উত্তর দিন অথবা আমাদের ড্যাশবোর্ডে যান।</p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #475569;">&copy; ${new Date().getFullYear()} মিল চার্ট। সহজ মেস ব্যবস্থাপনা।</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject: `আপনার অ্যাডমিন ড্যাশবোর্ড প্রস্তুত - ${groupName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send admin welcome email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendMoneyReceiptEmail(
  memberEmail: string,
  fullName: string,
  amount: number,
  date: string,
  adminName: string,
  groupName: string,
  totalAmount: number,
  remainingBalance: number,
) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <h1 style="color: #10b981; font-size: 24px; text-align: center; margin-bottom: 20px;">টাকা জমার রিসিট</h1>
        <p style="font-size: 16px; line-height: 1.6;">প্রিয় <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">আপনার জমার টাকা সফলভাবে গ্রহণ করা হয়েছে।</p>

        <div style="background-color: #fff; padding: 25px; border-radius: 8px; margin: 20px 0; border: 1px dashed #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">গৃহীত টাকার পরিমাণ:</span>
            <span 
              style="
                font-size: 20px;
                font-weight: bold;
                color: ${amount < 0 ? "#ef4444" : "#10b981"};
              "
            >${amount.toFixed(2)} টাকা</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
            <span style="color: #666;">মোট জমা (বর্তমান চার্ট):</span>
            <span 
              style="
                font-size: 20px;
                font-weight: bold;
                color: ${totalAmount < 0 ? "#ef4444" : "#10b981"};
              "
            >${totalAmount.toFixed(2)} টাকা</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
            <span style="color: #666;">বর্তমান ব্যালেন্স:</span>
            <span 
              style="
                font-size: 20px;
                font-weight: bold;
                color: ${remainingBalance < 0 ? "#ef4444" : "#10b981"};
              "
            >${remainingBalance >= 0 ? "+" : ""}${remainingBalance.toFixed(2)} টাকা</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">তারিখ:</span>
            <span style="font-weight: 500;">${escapeHtml(date)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">টাকা গ্রহণকারী:</span>
            <span style="font-weight: 500;">${escapeHtml(adminName)}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #10b981; text-align: center;">গ্রুপ: ${escapeHtml(groupName)}</p>
        <p style="text-align: center; margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">লেনদেনের ইতিহাস দেখুন</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">এটি মিল চার্ট থেকে পাঠানো একটি স্বয়ংক্রিয় রিসিট। আপনার রেকর্ডের জন্য সংরক্ষণ করুন।</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `টাকা জমার রিসিট: ${amount.toFixed(2)} টাকা - ${groupName}`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send receipt email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendMonthSummaryEmails(input: {
  groupName: string;
  chartLabel: string;
  members: Member[];
  meals: MealEntry[];
  costs: CostEntry[];
  deposits: DepositEntry[];
  pdfAttachment?: string;
}) {
  const { groupName, chartLabel, members, meals, costs, deposits, pdfAttachment } = input;
  console.log(`[Email] Starting monthly summary batch for group "${groupName}" (${chartLabel}) to ${members.length} members.`);

  try {
    const { totalMeals, totalCost, totalPaid, mealRate, remainingTaka } = getMonthTotals(
      meals,
      costs,
      deposits,
    );

    type EmailResult = 
      | { status: 'fulfilled'; value: { email: string; success: true } }
      | { status: 'rejected'; reason: unknown };

    const results: EmailResult[] = [];

    for (const member of members) {
      try {
        if (!member.email || !member.email.includes("@")) {
          throw new Error(`Invalid email for member ${member.fullName}`);
        }

        const totals = getMemberTotals(member.id, meals, deposits, mealRate);

        const html = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; color: #333; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e293b; margin: 0; font-size: 28px;">মাসিক মিল ও হিসাবের বিবরণী</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 18px;">${escapeHtml(chartLabel)} • ${escapeHtml(groupName)}</p>
            </div>

            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px;">প্রিয় <strong>${escapeHtml(member.fullName)}</strong>,</p>
              <p style="margin: 0; line-height: 1.6; color: #475569;"><strong>${escapeHtml(chartLabel)}</strong> মাসের হিসাব সম্পন্ন ও লক করা হয়েছে। নিচে আপনার ব্যক্তিগত হিসাব বিবরণী দেওয়া হলো:</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">মোট মিল</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${formatMeal(totals.totalMeals)}</p>
              </div>
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">মোট জমা</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${totals.totalPaid.toFixed(2)} টাকা</p>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">মিল রেট</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${mealRate.toFixed(4)} টাকা</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">ব্যক্তিগত খাবার খরচ (${formatMeal(totals.totalMeals)} × ${mealRate.toFixed(2)})</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${totals.totalCost.toFixed(2)} টাকা</td>
              </tr>
              <tr>
                <td style="padding: 15px 0; color: #1e293b; font-weight: bold; font-size: 18px;">বর্তমান ব্যালেন্স</td>
                <td style="padding: 15px 0; text-align: right; color: ${totals.balance >= 0 ? "#10b981" : "#ef4444"}; font-weight: bold; font-size: 18px;">
                  ${totals.balance >= 0 ? "+" : ""}${totals.balance.toFixed(2)} টাকা
                </td>
              </tr>
            </table>

            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">গ্রুপের সর্বমোট হিসাব</p>
              <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট বাজার খরচ</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalCost.toFixed(2)} টাকা</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট মিল</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${formatMeal(totalMeals)}</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট জমা টাকা</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalPaid.toFixed(2)} টাকা</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">অবশিষ্ট টাকা</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600; color: ${remainingTaka >= 0 ? "#10b981" : "#ef4444"};">
                    ${remainingTaka >= 0 ? "+" : ""}${remainingTaka.toFixed(2)} টাকা
                  </p>
                </div>
              </div>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">আপনার টাকা জমার ইতিহাস</p>
              ${buildDepositSummary(member, deposits)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">আপনার মিলের তালিকা</p>
              ${buildMealChartTable(member, meals)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">বাজার খরচের তালিকা</p>
              ${buildCostBreakdown(costs)}
            </div>

            <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
              <p>অ্যাডমিন চার্ট লক করার পর এই রিপোর্টটি স্বয়ংক্রিয়ভাবে তৈরি করা হয়েছে।</p>
              <p>© ${new Date().getFullYear()} মিল চার্ট অ্যাপ</p>
            </div>
          </div>
        `;

        const mailOptions: SendMailOptions = {
          from: fromEmail,
          to: member.email,
          subject: `মাসিক হিসাব রিপোর্ট: ${chartLabel} - ${groupName}`,
          html,
        };

        if (pdfAttachment) {
          mailOptions.attachments = [
            {
              filename: `${chartLabel}_Report.pdf`,
              content: pdfAttachment,
              encoding: "base64",
              contentType: "application/pdf"
            }
          ];
        }

        await transporter.sendMail(mailOptions);

        console.log(`[Email] Successfully sent report to ${member.email}`);
        results.push({ status: 'fulfilled', value: { email: member.email, success: true } });
      } catch (err) {
        console.error(`[Email] Failed to send to ${member.email}:`, err);
        results.push({ status: 'rejected', reason: err });
      }
    }

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.filter((r) => r.status === "rejected" || !r.value.success);

    if (failed.length > 0) {
      console.error(`[Email] Batch completed with ${failed.length} failures out of ${members.length}.`);
      failed.forEach((f) => {
        if (f.status === "rejected") console.error(`[Email] Failure:`, f.reason);
      });
    } else {
      console.log(`[Email] Batch completed successfully! Sent ${successful} reports.`);
    }

    return {
      success: true,
      sentCount: successful,
      failedCount: failed.length,
      totalCount: members.length,
    };
  } catch (error) {
    console.error("[Email] Critical batch failure:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendVerificationEmail(
  email: string,
  fullName: string,
  verificationUrl: string
) {
  try {
    const html = `
      <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 16px; border: 1px solid #e5e7eb;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="display: inline-block; margin-bottom: 16px;">
            <span style="font-size: 36px;">🍚</span>
          </div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 800;">মিল চার্ট-এ স্বাগতম!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">শুরু করতে অনুগ্রহ করে আপনার ইমেইল ঠিকানাটি যাচাই করুন।</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px; background: white; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
            প্রিয় <strong style="color: #1f2937;">${escapeHtml(fullName)}</strong>,
          </p>

          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
            সাইন আপ করার জন্য ধন্যবাদ! রেজিস্ট্রেশন সম্পন্ন করতে নিচের বাটনে ক্লিক করে আপনার ইমেইল ঠিকানাটি যাচাই করুন।
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verificationUrl}" style="
              display: inline-block;
              background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
              color: white;
              text-decoration: none;
              font-size: 16px;
              font-weight: 700;
              padding: 16px 40px;
              border-radius: 10px;
              box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
            ">
              আমার ইমেইল ঠিকানা যাচাই করুন
            </a>
          </div>

          <!-- Backup Link -->
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              বাটনটি কাজ না করলে নিচের লিংকটি কপি করে আপনার ব্রাউজারে পেস্ট করুন:
            </p>
            <p style="margin: 8px 0 0 0; word-break: break-all; font-size: 13px; color: #6366f1;">
              ${verificationUrl}
            </p>
          </div>

          <div style="border-top: 1px solid #e5e7eb; margin: 32px 0 0 0; padding-top: 24px;">
            <p style="margin: 0; font-size: 14px; color: #9ca3af;">
              আপনি যদি মিল চার্ট-এ সাইন আপ না করে থাকেন, তবে নির্দ্বিধায় এই ইমেইলটি উপেক্ষা করতে পারেন।
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px 0; color: #9ca3af; font-size: 13px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} মিল চার্ট। সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: email,
      subject: "ইমেইল ঠিকানা যাচাই করুন - মিল চার্ট",
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendReminderEmails(input: {
  groupName: string;
  chartLabel: string;
  members: Member[];
  meals: MealEntry[];
  costs: CostEntry[];
  deposits: DepositEntry[];
}) {
  const { groupName, chartLabel, members, meals, costs, deposits } = input;
  console.log(`[Email] Starting reminder batch for group "${groupName}" (${chartLabel}) to ${members.length} members.`);

  try {
    const { totalMeals, totalCost, totalPaid, mealRate, remainingTaka } = getMonthTotals(
      meals,
      costs,
      deposits,
    );

    type EmailResult = 
      | { status: 'fulfilled'; value: { email: string; success: true } }
      | { status: 'rejected'; reason: unknown };

    const results: EmailResult[] = [];

    for (const member of members) {
      try {
        if (!member.email || !member.email.includes("@")) {
          throw new Error(`Invalid email for member ${member.fullName}`);
        }

        const totals = getMemberTotals(member.id, meals, deposits, mealRate);

        const html = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; color: #333; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">🔔 টাকা পরিশোধের তাগিদ</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 18px;">${escapeHtml(chartLabel)} • ${escapeHtml(groupName)}</p>
            </div>

            <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #fcd34d;">
              <p style="margin: 0 0 15px 0; font-size: 16px;">প্রিয় <strong>${escapeHtml(member.fullName)}</strong>,</p>
              <p style="margin: 0; line-height: 1.6; color: #92400e;"><strong>${escapeHtml(chartLabel)}</strong> মাসের মিল অ্যাকাউন্টের বর্তমান ব্যালেন্স সম্পর্কে আপনাকে স্মরণ করিয়ে দেওয়া হচ্ছে।</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">মোট মিল</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${formatMeal(totals.totalMeals)}</p>
              </div>
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">মোট জমা</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${totals.totalPaid.toFixed(2)} টাকা</p>
              </div>
            </div>

            <div style="background-color: ${totals.balance < 0 ? "#fef2f2" : "#f0fdf4"}; border: 2px solid ${totals.balance < 0 ? "#fecaca" : "#bbf7d0"}; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
              <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: ${totals.balance < 0 ? "#b91c1c" : "#166534"}; font-weight: bold;">আপনার বর্তমান ব্যালেন্স</p>
              <p style="margin: 10px 0 0 0; font-size: 40px; font-weight: bold; color: ${totals.balance >= 0 ? "#10b981" : "#ef4444"};">
                ${totals.balance >= 0 ? "+" : ""}${totals.balance.toFixed(2)} টাকা
              </p>
              ${totals.balance < 0 ? `
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #991b1b;">
                  ⚠️ আপনার ব্যালেন্স মাইনাস (-) রয়েছে। বকেয়া পরিশোধ করতে অনুগ্রহ করে <strong>${Math.abs(totals.balance).toFixed(2)} টাকা</strong> জমা দিন!
                </p>
              ` : `
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #166534;">
                  ✅ আপনার ব্যালেন্স পজিটিভ রয়েছে!
                </p>
              `}
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">মিল রেট</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${mealRate.toFixed(4)} টাকা</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">ব্যক্তিগত খাবার খরচ (${formatMeal(totals.totalMeals)} × ${mealRate.toFixed(2)})</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${totals.totalCost.toFixed(2)} টাকা</td>
              </tr>
            </table>

            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">গ্রুপের সর্বমোট হিসাব</p>
              <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট বাজার খরচ</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalCost.toFixed(2)} টাকা</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট মিল</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${formatMeal(totalMeals)}</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">মোট জমা টাকা</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalPaid.toFixed(2)} টাকা</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">অবশিষ্ট টাকা</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600; color: ${remainingTaka >= 0 ? "#10b981" : "#ef4444"};">
                    ${remainingTaka >= 0 ? "+" : ""}${remainingTaka.toFixed(2)} টাকা
                  </p>
                </div>
              </div>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">আপনার টাকা জমার ইতিহাস</p>
              ${buildDepositSummary(member, deposits)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">আপনার মিলের তালিকা</p>
              ${buildMealChartTable(member, meals)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">বাজার খরচের তালিকা</p>
              ${buildCostBreakdown(costs)}
            </div>

            <p style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                আপনার অ্যাকাউন্ট দেখুন
              </a>
            </p>

            <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
              <p>এটি একটি সৌজন্যমূলক তাগিদ বার্তা। আপনি ইতিমধ্যে টাকা জমা দিয়ে থাকলে এই ইমেইলটি উপেক্ষা করতে পারেন।</p>
              <p>© ${new Date().getFullYear()} মিল চার্ট অ্যাপ</p>
            </div>
          </div>
        `;

        const mailOptions: SendMailOptions = {
          from: fromEmail,
          to: member.email,
          subject: `টাকা পরিশোধের তাগিদ: ${chartLabel} - ${groupName}`,
          html,
        };

        await transporter.sendMail(mailOptions);

        console.log(`[Email] Successfully sent reminder to ${member.email}`);
        results.push({ status: 'fulfilled', value: { email: member.email, success: true } });
      } catch (err) {
        console.error(`[Email] Failed to send to ${member.email}:`, err);
        results.push({ status: 'rejected', reason: err });
      }
    }

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.filter((r) => r.status === "rejected" || !r.value.success);

    if (failed.length > 0) {
      console.error(`[Email] Batch completed with ${failed.length} failures out of ${members.length}.`);
      failed.forEach((f) => {
        if (f.status === "rejected") console.error(`[Email] Failure:`, f.reason);
      });
    } else {
      console.log(`[Email] Batch completed successfully! Sent ${successful} reminders.`);
    }

    return {
      success: true,
      sentCount: successful,
      failedCount: failed.length,
      totalCount: members.length,
    };
  } catch (error) {
    console.error("[Email] Critical reminder batch failure:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendAccountDeletionEmails(input: {
  groupName: string;
  adminName: string;
  adminEmail: string;
  recipients: Array<{ email: string; name?: string; role?: string }>;
}) {
  try {
    const { groupName, adminName, adminEmail, recipients } = input;
    const seen = new Set<string>();
    const uniqueRecipients: Array<{ email: string; name?: string; role?: string }> = [];
    for (const r of recipients) {
      const norm = r.email?.trim().toLowerCase();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        uniqueRecipients.push({ ...r, email: norm });
      }
    }

    if (uniqueRecipients.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0, totalCount: 0 };
    }

    const deletionDate = new Date().toLocaleString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const recipient of uniqueRecipients) {
      try {
        const recipientDisplayName = recipient.name?.trim() || recipient.email;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; font-size: 36px; line-height: 1;">⚠️</span>
              <h1 style="color: #991b1b; font-size: 22px; margin: 12px 0 4px 0; font-weight: 700;">অ্যাকাউন্ট ও গ্রুপ মুছে ফেলা হয়েছে</h1>
              <p style="color: #b91c1c; font-size: 14px; margin: 0; font-weight: 600;">${escapeHtml(groupName)}</p>
            </div>

            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #7f1d1d; line-height: 1.6;">
                <strong>প্রিয় ${escapeHtml(recipientDisplayName)},</strong>
              </p>
              <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.6;">
                মিল চার্ট গ্রুপের প্রশাসনিক অ্যাকাউন্ট এবং <strong>&ldquo;${escapeHtml(groupName)}&rdquo;</strong> গ্রুপটি <strong>${escapeHtml(adminName)}</strong> (${escapeHtml(adminEmail)}) দ্বারা স্থায়ীভাবে মুছে ফেলা হয়েছে।
              </p>
            </div>

            <div style="margin-bottom: 24px;">
              <h3 style="color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">এর প্রভাব ও বিস্তারিত:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
                <li>সকল মাসিক মিল চার্ট, দৈনিক মিলের হিসাব এবং উপস্থিতির যাবতীয় তথ্য স্থায়ীভাবে মুছে ফেলা হয়েছে।</li>
                <li>সকল জমা টাকার রেকর্ড এবং বাজার খরচের তালিকা মুছে ফেলা হয়েছে।</li>
                <li>এই গ্রুপের সদস্য ও অ্যাডমিনদের সকল লগইন এবং অ্যাক্সেস নিষ্ক্রিয় করা হয়েছে।</li>
              </ul>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 4px 0;">মুছে ফেলার তারিখ ও সময়: ${deletionDate}</p>
              <p style="margin: 0;">মিল চার্ট অ্যাপ &middot; স্বয়ংক্রিয় নিরাপত্তা বিজ্ঞপ্তি</p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: fromEmail,
          to: recipient.email,
          subject: `[মিল চার্ট] অ্যাকাউন্ট ও গ্রুপ মুছে ফেলা হয়েছে: ${groupName}`,
          html,
        });

        results.push({ email: recipient.email, success: true });
      } catch (sendErr) {
        console.error(`[Email] Failed to send deletion notice to ${recipient.email}:`, sendErr);
        results.push({ email: recipient.email, success: false, error: getErrorMessage(sendErr) });
      }
    }

    const sentCount = results.filter((r) => r.success).length;
    return {
      success: true,
      sentCount,
      failedCount: results.length - sentCount,
      totalCount: results.length,
    };
  } catch (err) {
    console.error("[Email] sendAccountDeletionEmails failed:", err);
    return { success: false, error: getErrorMessage(err) };
  }
}

