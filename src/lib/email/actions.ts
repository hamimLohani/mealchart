"use server";

import { transporter, fromEmail } from "./transporter";
import { getMonthTotals, getMemberTotals, formatMeal } from "@/lib/utils/meal-money";
import type { CostEntry, DepositEntry, MealEntry, Member } from "@/types/domain";

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
    return `<p style="margin: 0; color: #64748b;">No meals were recorded for this member in the selected month.</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Date</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Meals</th>
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
    return `<p style="margin: 0; color: #64748b;">No cost entries were recorded for this month.</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Item</th>
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Date</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Amount</th>
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
                <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">${cost.amount.toFixed(2)} TK</td>
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
    return `<p style="margin: 0; color: #64748b;">No money deposits were recorded for this member in this month.</p>`;
  }

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: #f8fafc;">
          <th style="padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Date</th>
          <th style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${memberDeposits
      .map(
        (deposit) => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">${escapeHtml(deposit.date)}</td>
                <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9;">${deposit.amount.toFixed(2)} TK</td>
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
        <h1 style="color: #6366f1; font-size: 24px; text-align: center; margin-bottom: 20px;">Welcome to ${escapeHtml(groupName)}!</h1>
        <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">We are excited to have you in our group. Your meal account has been created successfully.</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 14px; color: #666;">Group Name:</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${escapeHtml(groupName)}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">You can now track your meals, deposits, and monthly costs through our portal.</p>
        <p style="text-align: center; margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">This is an automated email from Meal Chart. Please do not reply.</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `Welcome to ${groupName}!`,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendRemovalEmail(memberEmail: string, fullName: string, groupName: string) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <h1 style="color: #ef4444; font-size: 24px; text-align: center; margin-bottom: 20px;">Account Removed</h1>
        <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">Your member account for <strong>${escapeHtml(groupName)}</strong> has been removed by the administrator.</p>
        <div style="background-color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 14px; color: #666;">Group Name:  </p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">${escapeHtml(groupName)}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">If you believe this was a mistake, please contact your group administrator.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">This is an automated email from Meal Chart. Please do not reply.</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `Account Removed - ${groupName}`,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send removal email:", error);
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
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Welcome, Chief!</h1>
            <p style="margin-top: 10px; color: #94a3b8; font-size: 16px;">Your workspace for <strong>${escapeHtml(groupName)}</strong> is ready.</p>
          </div>

          <!-- Content -->
          <div style="padding: 0 40px 40px 40px;">
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Hello ${escapeHtml(adminName)},</p>
            <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Congratulations on setting up your group. You now have full control over the meal management for your team. Here is your quick-start guide to mastering the platform:</p>

            <div style="margin: 30px 0; background: rgba(30, 41, 59, 0.5); border-radius: 16px; padding: 25px; border: 1px solid #334155;">
              <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #818cf8;">Group Management Checklist</h3>
              
              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">👥</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">Add Your Members</strong>
                  <span style="font-size: 13px; color: #94a3b8;">Head to "Admin Members" to manually add users or share your group link for them to join.</span>
                </div>
              </div>

              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">📊</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">Create a Monthly Chart</strong>
                  <span style="font-size: 13px; color: #94a3b8;">Every month starts with a fresh chart. Create one to begin tracking meals and deposits.</span>
                </div>
              </div>

              <div style="margin-bottom: 15px; display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">💸</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">Manage Costs & Receipts</strong>
                  <span style="font-size: 13px; color: #94a3b8;">Log group expenses and deposits. Members receive instant email receipts for every payment.</span>
                </div>
              </div>

              <div style="display: flex; align-items: flex-start;">
                <span style="margin-right: 12px;">🔒</span>
                <div style="flex: 1;">
                  <strong style="display: block; color: #f8fafc; font-size: 15px;">Lock & Finalize</strong>
                  <span style="font-size: 13px; color: #94a3b8;">At the end of the month, lock the chart. We'll automatically calculate balances and email full reports to everyone.</span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}" 
                 style="background: linear-gradient(to right, #6366f1, #a855f7); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);">
                Enter Admin Panel
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 40px; background: rgba(15, 23, 42, 0.5); border-top: 1px solid #334155; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">Need help? Reply to this email or visit our documentation.</p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #475569;">&copy; ${new Date().getFullYear()} Meal Chart. Empowering group finances.</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject: `Your Admin Dashboard is Ready - ${groupName}`,
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
) {
  try {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 12px; border: 1px solid #eee;">
        <h1 style="color: #10b981; font-size: 24px; text-align: center; margin-bottom: 20px;">Money Receipt</h1>
        <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">We have successfully received your payment for the current month.</p>

        <div style="background-color: #fff; padding: 25px; border-radius: 8px; margin: 20px 0; border: 1px dashed #10b981; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">Amount Received:  </span>
            <span 
              style="
                font-size: 20px;
                font-weight: bold;
                color: ${amount < 0 ? "#ef4444" : "#10b981"};
              "
            >${amount.toFixed(2)} TK</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9;">
            <span style="color: #666;">Total Deposited (This Month):  </span>
            <span 
              style="
                font-size: 20px;
                font-weight: bold;
                color: ${totalAmount < 0 ? "#ef4444" : "#10b981"};
              "
            >${totalAmount.toFixed(2)} TK</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">Date:  </span>
            <span style="font-weight: 500;">${escapeHtml(date)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">Collected By:  </span>
            <span style="font-weight: 500;">${escapeHtml(adminName)}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #10b981; text-align: center;">Group: ${escapeHtml(groupName)}</p>
        <p style="text-align: center; margin-top: 30px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://mealchart.vercel.app"}"style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Transaction History</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">This is an automated receipt from Meal Chart. Please keep it for your records.</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: memberEmail,
      subject: `Receipt: ${amount.toFixed(2)} TK - ${groupName}`,
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
}) {
  const { groupName, chartLabel, members, meals, costs, deposits } = input;
  console.log(`[Email] Starting monthly summary batch for group "${groupName}" (${chartLabel}) to ${members.length} members.`);

  try {
    const { totalMeals, totalCost, totalPaid, mealRate, remainingTaka } = getMonthTotals(
      meals,
      costs,
      deposits,
    );

    const results: any[] = [];

    for (const member of members) {
      try {
        if (!member.email || !member.email.includes("@")) {
          throw new Error(`Invalid email for member ${member.fullName}`);
        }

        const totals = getMemberTotals(member.id, meals, deposits, mealRate);

        const html = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; color: #333; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e293b; margin: 0; font-size: 28px;">Monthly Meal Summary</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 18px;">${escapeHtml(chartLabel)} • ${escapeHtml(groupName)}</p>
            </div>

            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="margin: 0 0 15px 0; font-size: 16px;">Hello <strong>${escapeHtml(member.fullName)}</strong>,</p>
              <p style="margin: 0; line-height: 1.6; color: #475569;">The accounts for <strong>${escapeHtml(chartLabel)}</strong> have been finalized. Here is your individual report:</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">Total Meals</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${formatMeal(totals.totalMeals)}</p>
              </div>
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em;">Total Paid</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold;">${totals.totalPaid.toFixed(2)} TK</p>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Meal Rate</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${mealRate.toFixed(4)} TK</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Individual Cost (${formatMeal(totals.totalMeals)} × ${mealRate.toFixed(2)})</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${totals.totalCost.toFixed(2)} TK</td>
              </tr>
              <tr>
                <td style="padding: 15px 0; color: #1e293b; font-weight: bold; font-size: 18px;">Remaining Balance</td>
                <td style="padding: 15px 0; text-align: right; color: ${totals.balance >= 0 ? "#10b981" : "#ef4444"}; font-weight: bold; font-size: 18px;">
                  ${totals.balance >= 0 ? "+" : ""}${totals.balance.toFixed(2)} TK
                </td>
              </tr>
            </table>

            <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">GROUP TOTALS</p>
              <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">Total Costs</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalCost.toFixed(2)} TK</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">Total Meals</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${formatMeal(totalMeals)}</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">Total Paid</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600;">${totalPaid.toFixed(2)} TK</p>
                </div>
                <div style="min-width: 120px;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">Remaining Taka</p>
                  <p style="margin: 2px 0 0 0; font-weight: 600; color: ${remainingTaka >= 0 ? "#10b981" : "#ef4444"};">
                    ${remainingTaka >= 0 ? "+" : ""}${remainingTaka.toFixed(2)} TK
                  </p>
                </div>
              </div>
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">YOUR PAYMENT HISTORY</p>
              ${buildDepositSummary(member, deposits)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">YOUR MEAL CHART</p>
              ${buildMealChartTable(member, meals)}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 14px; color: #475569;">MONTHLY COSTS BREAKDOWN</p>
              ${buildCostBreakdown(costs)}
            </div>

            <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
              <p>This report was generated automatically when the month was locked by an admin.</p>
              <p>© ${new Date().getFullYear()} Meal Chart App</p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: fromEmail,
          to: member.email,
          subject: `Monthly Report: ${chartLabel} - ${groupName}`,
          html,
        });

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
