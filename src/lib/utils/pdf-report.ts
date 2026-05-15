import { jsPDF } from "jspdf";
import type { CostEntry, DepositEntry, MealEntry, Member } from "@/types/domain";
import { daysInMonth } from "./date";
import { formatMeal, getMonthTotals, getMemberTotals, normalizeMealQuantity } from "./meal-money";
import { memberDisplayName, memberIdsForChartRows } from "./chart-members";

type ChartReportOptions = {
  groupName: string;
  chartLabel: string;
  monthKey: string;
  members: Member[];
  meals: MealEntry[];
  costs: CostEntry[];
  deposits: DepositEntry[];
  fileName?: string;
};

export function saveChartReportPdf(options: ChartReportOptions) {
  const { groupName, chartLabel, monthKey, members, meals, costs, deposits, fileName } = options;
  
  // Guard against invalid monthKey format
  const parts = monthKey.split("-");
  if (parts.length !== 2) {
    throw new Error(`Invalid monthKey format: ${monthKey}. Expected YYYY-MM.`);
  }
  const [year, month] = parts.map((value) => Number(value));
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid monthKey values: year=${year}, month=${month}`);
  }
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, "0")}`);

  type RgbColor = [number, number, number];
  const totals = getMonthTotals(meals, costs, deposits);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const textColor: Record<"dark" | "muted" | "accent", RgbColor> = {
    dark: [17, 24, 39],
    muted: [71, 85, 105],
    accent: [59, 130, 246],
  };

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Meal Chart Report", margin, 56);

  doc.setFontSize(11);
  doc.setTextColor(245, 245, 245);
  doc.text(`Group: ${groupName}`, margin, 80);
  doc.text(`Month: ${chartLabel}`, margin + 300, 80);

  const summaryTop = 110;
  const summaryHeight = 96;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, summaryTop, contentWidth, summaryHeight, 10, 10, "FD");

  doc.setFontSize(11);
  doc.setTextColor(...textColor.dark);
  const summaryLabelX = margin + 12;
  const summaryValueX = margin + 128;
  const summaryLineHeight = 18;
  doc.text(`Total meals`, summaryLabelX, summaryTop + 24);
  doc.text(formatMeal(totals.totalMeals), summaryValueX, summaryTop + 24);
  doc.text(`Total cost`, summaryLabelX, summaryTop + 24 + summaryLineHeight);
  doc.text(`${totals.totalCost.toFixed(2)} Tk`, summaryValueX, summaryTop + 24 + summaryLineHeight);
  doc.text(`Total paid`, summaryLabelX, summaryTop + 24 + summaryLineHeight * 2);
  doc.text(`${totals.totalPaid.toFixed(2)} Tk`, summaryValueX, summaryTop + 24 + summaryLineHeight * 2);

  doc.text(`Meal rate`, summaryLabelX + 280, summaryTop + 24);
  doc.text(`${totals.mealRate.toFixed(2)} Tk`, summaryValueX + 280, summaryTop + 24);
  doc.text(`Remaining`, summaryLabelX + 280, summaryTop + 24 + summaryLineHeight);
  doc.text(`${totals.remainingTaka.toFixed(2)} Tk`, summaryValueX + 280, summaryTop + 24 + summaryLineHeight);
  doc.text(`Members`, summaryLabelX + 280, summaryTop + 24 + summaryLineHeight * 2);
  doc.text(String(memberIdsForChartRows(members, meals, monthKey).length), summaryValueX + 280, summaryTop + 24 + summaryLineHeight * 2);

  const tableTop = summaryTop + summaryHeight + 30;
  const rowMemberIds = memberIdsForChartRows(members, meals, monthKey);
  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((meal) => {
    const memberId = meal.memberId.toLowerCase();
    mealMap[memberId] = mealMap[memberId] ?? {};
    mealMap[memberId][meal.date] = normalizeMealQuantity(meal.quantity);
  });

  const nameWidth = 100;
  const dayWidth = 16;
  const totalWidth = 35;
  const paidWidth = 45;
  const balanceWidth = 50;
  const tableWidth = nameWidth + totalDays * dayWidth + totalWidth + paidWidth + balanceWidth;
  const tableLeft = (pageWidth - tableWidth) / 2; // Center the table
  const headerHeight = 20;
  const bodyRowHeight = 18;
  const bottomLimit = pageHeight - margin;

  const drawTableHeader = (top: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(tableLeft, top, tableWidth, headerHeight, "F");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    let x = tableLeft + 4;
    doc.text("Member", x, top + 13);
    x += nameWidth;
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const label = String(dayIndex + 1);
      doc.text(label, x + dayWidth / 2, top + 13, { align: "center" });
      x += dayWidth;
    }
    doc.text("Meals", x + totalWidth / 2, top + 13, { align: "center" });
    x += totalWidth;
    doc.text("Paid", x + paidWidth / 2, top + 13, { align: "center" });
    x += paidWidth;
    doc.text("Balance", x + balanceWidth / 2, top + 13, { align: "center" });
  };

  let currentY = tableTop;
  drawTableHeader(currentY);
  currentY += headerHeight;

  const addPageAndHeader = () => {
    doc.addPage();
    currentY = margin;
    drawTableHeader(currentY);
    currentY += headerHeight;
  };

  rowMemberIds.forEach((memberId, rowIndex) => {
    if (currentY + bodyRowHeight > bottomLimit) {
      addPageAndHeader();
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(tableLeft, currentY, tableWidth, bodyRowHeight, "F");
    }

    const memberName = memberDisplayName(memberId, members, "Former member");
    doc.setFontSize(9);
    doc.setTextColor(...textColor.dark);
    const nameLines = doc.splitTextToSize(memberName, nameWidth - 8);
    doc.text(nameLines, tableLeft + 4, currentY + 13);

    let x = tableLeft + nameWidth;
    const memberTotals = getMemberTotals(memberId, meals, deposits, totals.mealRate);

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const dayKey = days[dayIndex];
      const value = mealMap[memberId]?.[dayKey];
      if (value) {
        doc.text(formatMeal(value), x + dayWidth / 2, currentY + 13, { align: "center" });
      }
      x += dayWidth;
    }

    doc.text(formatMeal(memberTotals.totalMeals), x + totalWidth / 2, currentY + 13, { align: "center" });
    x += totalWidth;
    doc.text(memberTotals.totalPaid.toFixed(1), x + paidWidth / 2, currentY + 13, { align: "center" });
    x += paidWidth;

    const balance = memberTotals.balance;
    if (balance < 0) {
      doc.setTextColor(185, 28, 28); // Red
    } else if (balance > 0) {
      doc.setTextColor(21, 128, 61); // Green
    }
    doc.text(balance.toFixed(1), x + balanceWidth / 2, currentY + 13, { align: "center" });
    doc.setTextColor(...textColor.dark); // Reset
    
    currentY += bodyRowHeight;
  });

  if (currentY + bodyRowHeight > bottomLimit) {
    addPageAndHeader();
  }

  doc.setFillColor(15, 23, 42);
  doc.rect(tableLeft, currentY, tableWidth, bodyRowHeight, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", tableLeft + 4, currentY + 13);
  let x = tableLeft + nameWidth;
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const dayKey = days[dayIndex];
    const dayTotal = rowMemberIds.reduce((sum, id) => sum + (mealMap[id]?.[dayKey] ?? 0), 0);
    if (dayTotal) {
      doc.text(formatMeal(dayTotal), x + dayWidth / 2, currentY + 13, { align: "center" });
    }
    x += dayWidth;
  }
  doc.text(formatMeal(totals.totalMeals), x + totalWidth / 2, currentY + 13, { align: "center" });
  x += totalWidth;
  doc.text(totals.totalPaid.toFixed(1), x + paidWidth / 2, currentY + 13, { align: "center" });
  x += paidWidth;
  doc.text(totals.remainingTaka.toFixed(1), x + balanceWidth / 2, currentY + 13, { align: "center" });

  // Detailed Cost History Section
  currentY += bodyRowHeight + 40;

  if (costs.length > 0) {
    if (currentY + 60 > bottomLimit) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFontSize(14);
    doc.setTextColor(...textColor.dark);
    doc.text("Cost History", margin, currentY);
    currentY += 15;

    const costTableWidth = 400;
    const costTableLeft = margin;
    const colDateWidth = 100;
    const colItemWidth = 220;
    const colAmountWidth = 80;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(costTableLeft, currentY, costTableWidth, headerHeight, "F");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Date", costTableLeft + 8, currentY + 13);
    doc.text("Item Name", costTableLeft + colDateWidth + 8, currentY + 13);
    doc.text("Amount", costTableLeft + colDateWidth + colItemWidth + colAmountWidth - 8, currentY + 13, { align: "right" });
    
    currentY += headerHeight;

    costs.sort((a, b) => a.date.localeCompare(b.date)).forEach((cost, index) => {
      if (currentY + bodyRowHeight > bottomLimit) {
        doc.addPage();
        currentY = margin;
        // Repeat Header on new page
        doc.setFillColor(15, 23, 42);
        doc.rect(costTableLeft, currentY, costTableWidth, headerHeight, "F");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("Date", costTableLeft + 8, currentY + 13);
        doc.text("Item Name", costTableLeft + colDateWidth + 8, currentY + 13);
        doc.text("Amount", costTableLeft + colDateWidth + colItemWidth + colAmountWidth - 8, currentY + 13, { align: "right" });
        currentY += headerHeight;
      }

      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(costTableLeft, currentY, costTableWidth, bodyRowHeight, "F");
      }

      doc.setTextColor(...textColor.dark);
      doc.text(cost.date, costTableLeft + 8, currentY + 13);
      doc.text(cost.itemName, costTableLeft + colDateWidth + 8, currentY + 13);
      doc.text(`${cost.amount.toFixed(2)} Tk`, costTableLeft + colDateWidth + colItemWidth + colAmountWidth - 8, currentY + 13, { align: "right" });
      
      currentY += bodyRowHeight;
    });
  }

  doc.save(fileName || `${groupName}_${chartLabel}_Report.pdf`);
}
