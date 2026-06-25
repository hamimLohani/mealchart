import { jsPDF } from "jspdf";
import type { CostEntry, DepositEntry, MealEntry, Member } from "@/types/domain";
import { getChartDates } from "./date";
import { formatMeal, getMonthTotals, getMemberTotals, normalizeMealQuantity } from "./meal-money";
import { memberDisplayName, memberIdsForChartRows } from "./chart-members";

type ChartReportOptions = {
  groupName: string;
  chartLabel: string;
  monthKeys: string[];
  members: Member[];
  meals: MealEntry[];
  costs: CostEntry[];
  deposits: DepositEntry[];
  fileName?: string;
  outputType?: "save" | "base64";
};

export function saveChartReportPdf(options: ChartReportOptions): string | void {
  const { groupName, chartLabel, monthKeys, members, meals, costs, deposits, fileName, outputType = "save" } = options;

  if (!monthKeys || monthKeys.length === 0) {
    throw new Error(`Invalid monthKeys array. Must not be empty.`);
  }

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
  const borderColor: RgbColor = [226, 232, 240];
  const headerColor: RgbColor = [15, 23, 42];
  const rowAltColor: RgbColor = [248, 250, 252];
  const generatedAt = new Date().toLocaleDateString();

  const fitText = (text: string, width: number) => {
    let value = text;
    while (doc.getTextWidth(value) > width && value.length > 4) {
      value = `${value.slice(0, -4)}...`;
    }
    return value;
  };

  const money = (value: number, decimals = 2) => `${value.toFixed(decimals)} Tk`;
  const memberNameById = (memberId: string) => memberDisplayName(memberId.toLowerCase(), members, "Former member");

  const drawPageHeader = (title = "Meal Chart Report") => {
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 88, "F");
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(226, 232, 240);
    doc.text(`Group: ${groupName}`, margin, 62);
    doc.text(`Month: ${chartLabel}`, margin + 300, 62);
    doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 62, { align: "right" });
  };

  const rowMemberIds = memberIdsForChartRows(members, meals, monthKeys);
  const bottomLimit = pageHeight - margin;

  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((meal) => {
    const memberId = meal.memberId.toLowerCase();
    mealMap[memberId] = mealMap[memberId] ?? {};
    mealMap[memberId][meal.date] = normalizeMealQuantity(meal.quantity);
  });

  // Page 1 Setup
  drawPageHeader();

  // Summary Cards
  const summaryTop = 108;
  const cardGap = 10;
  const cardCount = 6;
  const cardWidth = (contentWidth - cardGap * (cardCount - 1)) / cardCount;
  const cardHeight = 58;
  const summaryItems = [
    { label: "Total meals", value: formatMeal(totals.totalMeals) },
    { label: "Total cost", value: money(totals.totalCost) },
    { label: "Total paid", value: money(totals.totalPaid) },
    { label: "Meal rate", value: money(totals.mealRate) },
    { label: "Remaining", value: money(totals.remainingTaka) },
    { label: "Members", value: String(rowMemberIds.length) },
  ];

  summaryItems.forEach((item, index) => {
    const left = margin + index * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(left, summaryTop, cardWidth, cardHeight, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textColor.muted);
    doc.text(item.label.toUpperCase(), left + 10, summaryTop + 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...textColor.dark);
    doc.text(fitText(item.value, cardWidth - 20), left + 10, summaryTop + 40);
  });

  let currentY = summaryTop + cardHeight + 28; // ~194

  const headerHeight = 22;
  const bodyRowHeight = 18;

  // Month Tables Loop
  for (const monthKey of monthKeys) {
    const daysOfMonth = getChartDates([monthKey]);
    const totalDays = daysOfMonth.length;

    // Sizing
    const nameWidth = 130;
    const totalWidth = 50;
    const dayWidth = (contentWidth - nameWidth - totalWidth) / totalDays;
    const tableWidth = nameWidth + totalDays * dayWidth + totalWidth;
    const tableLeft = margin;

    // Check page break
    const tableSectionHeight = 22 + headerHeight + (rowMemberIds.length * bodyRowHeight) + bodyRowHeight + 20;
    if (currentY + tableSectionHeight > bottomLimit) {
      doc.addPage();
      drawPageHeader();
      currentY = 108;
    }

    // Month Title
    const [y, m] = monthKey.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...textColor.dark);
    doc.text(monthLabel, margin, currentY + 12);
    currentY += 22;

    // Draw Month Table Header
    doc.setFillColor(...headerColor);
    doc.rect(tableLeft, currentY, tableWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Member", tableLeft + 8, currentY + 14);

    let x = tableLeft + nameWidth;
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const label = daysOfMonth[dayIndex].slice(8);
      doc.text(label, x + dayWidth / 2, currentY + 14, { align: "center" });
      x += dayWidth;
    }
    doc.text("Meals", x + totalWidth / 2, currentY + 14, { align: "center" });
    currentY += headerHeight;

    // Draw Month Table Body
    rowMemberIds.forEach((memberId, rowIndex) => {
      if (rowIndex % 2 === 0) {
        doc.setFillColor(...rowAltColor);
        doc.rect(tableLeft, currentY, tableWidth, bodyRowHeight, "F");
      }
      doc.setDrawColor(...borderColor);
      doc.line(tableLeft, currentY + bodyRowHeight, tableLeft + tableWidth, currentY + bodyRowHeight);

      const memberName = memberDisplayName(memberId, members, "Former member");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...textColor.dark);
      doc.text(fitText(memberName, nameWidth - 12), tableLeft + 8, currentY + 12);

      let dx = tableLeft + nameWidth;
      doc.setFontSize(7);
      for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
        const dayKey = daysOfMonth[dayIndex];
        const val = mealMap[memberId]?.[dayKey];
        if (val) {
          doc.text(formatMeal(val), dx + dayWidth / 2, currentY + 12, { align: "center" });
        }
        dx += dayWidth;
      }

      // Month total meals
      const monthMealsTotal = daysOfMonth.reduce((sum, d) => sum + (mealMap[memberId]?.[d] ?? 0), 0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(formatMeal(monthMealsTotal), dx + totalWidth / 2, currentY + 12, { align: "center" });

      currentY += bodyRowHeight;
    });

    // Draw Month Table Footer
    doc.setFillColor(...headerColor);
    doc.rect(tableLeft, currentY, tableWidth, bodyRowHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Total", tableLeft + 8, currentY + 12);

    let fx = tableLeft + nameWidth;
    doc.setFontSize(7);
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const dayKey = daysOfMonth[dayIndex];
      const dayTotal = rowMemberIds.reduce((sum, id) => sum + (mealMap[id]?.[dayKey] ?? 0), 0);
      if (dayTotal) {
        doc.text(formatMeal(dayTotal), fx + dayWidth / 2, currentY + 12, { align: "center" });
      }
      fx += dayWidth;
    }

    const monthGrandTotal = rowMemberIds.reduce((sum, id) => sum + daysOfMonth.reduce((s, d) => s + (mealMap[id]?.[d] ?? 0), 0), 0);
    doc.setFontSize(8);
    doc.text(formatMeal(monthGrandTotal), fx + totalWidth / 2, currentY + 12, { align: "center" });

    currentY += bodyRowHeight + 20;
  }

  // Draw Overall Balances Table
  const summaryTableHeight = 22 + headerHeight + (rowMemberIds.length * bodyRowHeight) + bodyRowHeight + 20;
  if (currentY + summaryTableHeight > bottomLimit) {
    doc.addPage();
    drawPageHeader();
    currentY = 108;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...textColor.dark);
  doc.text("Overall Member Accounts Summary", margin, currentY + 12);
  currentY += 22;

  // Header column widths
  const balNameWidth = 210;
  const balMealsWidth = 140;
  const balCostWidth = 140;
  const balPaidWidth = 140;
  const balWidth = 140;
  const balTableWidth = balNameWidth + balMealsWidth + balCostWidth + balPaidWidth + balWidth;

  doc.setFillColor(...headerColor);
  doc.rect(margin, currentY, balTableWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Member", margin + 8, currentY + 14);

  let bx = margin + balNameWidth;
  doc.text("Total Meals", bx + balMealsWidth / 2, currentY + 14, { align: "center" });
  bx += balMealsWidth;
  doc.text("Total Cost", bx + balCostWidth / 2, currentY + 14, { align: "center" });
  bx += balCostWidth;
  doc.text("Total Paid", bx + balPaidWidth / 2, currentY + 14, { align: "center" });
  bx += balPaidWidth;
  doc.text("Balance", bx + balWidth / 2, currentY + 14, { align: "center" });
  currentY += headerHeight;

  // Table Body
  rowMemberIds.forEach((memberId, rowIndex) => {
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...rowAltColor);
      doc.rect(margin, currentY, balTableWidth, bodyRowHeight, "F");
    }
    doc.setDrawColor(...borderColor);
    doc.line(margin, currentY + bodyRowHeight, margin + balTableWidth, currentY + bodyRowHeight);

    const memberName = memberDisplayName(memberId, members, "Former member");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...textColor.dark);
    doc.text(fitText(memberName, balNameWidth - 12), margin + 8, currentY + 12);

    let dbx = margin + balNameWidth;
    const mTotals = getMemberTotals(memberId, meals, deposits, totals.mealRate);

    doc.text(formatMeal(mTotals.totalMeals), dbx + balMealsWidth / 2, currentY + 12, { align: "center" });
    dbx += balMealsWidth;
    doc.text(mTotals.totalCost.toFixed(2), dbx + balCostWidth / 2, currentY + 12, { align: "center" });
    dbx += balCostWidth;
    doc.text(mTotals.totalPaid.toFixed(2), dbx + balPaidWidth / 2, currentY + 12, { align: "center" });
    dbx += balPaidWidth;

    const balance = mTotals.balance;
    if (balance < 0) {
      doc.setTextColor(185, 28, 28); // Red
    } else if (balance > 0) {
      doc.setTextColor(21, 128, 61); // Green
    }
    doc.text((balance >= 0 ? "+" : "") + balance.toFixed(2), dbx + balWidth / 2, currentY + 12, { align: "center" });
    doc.setTextColor(...textColor.dark); // Reset

    currentY += bodyRowHeight;
  });

  // Table Footer
  doc.setFillColor(...headerColor);
  doc.rect(margin, currentY, balTableWidth, bodyRowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", margin + 8, currentY + 12);

  let tfx = margin + balNameWidth;
  doc.text(formatMeal(totals.totalMeals), tfx + balMealsWidth / 2, currentY + 12, { align: "center" });
  tfx += balMealsWidth;
  doc.text(totals.totalCost.toFixed(2), tfx + balCostWidth / 2, currentY + 12, { align: "center" });
  tfx += balCostWidth;
  doc.text(totals.totalPaid.toFixed(2), tfx + balPaidWidth / 2, currentY + 12, { align: "center" });
  tfx += balPaidWidth;
  doc.text((totals.remainingTaka >= 0 ? "+" : "") + totals.remainingTaka.toFixed(2), tfx + balWidth / 2, currentY + 12, { align: "center" });

  currentY += bodyRowHeight + 30;

  // Transaction History Section
  if (costs.length > 0 || deposits.length > 0) {
    if (currentY + 120 > bottomLimit) {
      doc.addPage();
      drawPageHeader("Transaction History");
      currentY = 108;
    }

    const historyGap = 24;
    const historyTableWidth = (contentWidth - historyGap) / 2;
    const costTableLeft = margin;
    const paidTableLeft = margin + historyTableWidth + historyGap;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textColor.dark);
    doc.text("Cost History", costTableLeft, currentY + 12);
    doc.text("Paid History", paidTableLeft, currentY + 12);
    currentY += 22;

    const drawHistoryHeader = (
      left: number,
      top: number,
      columns: { dateWidth: number; detailWidth: number; amountWidth: number; detailLabel: string },
    ) => {
      doc.setFillColor(...headerColor);
      doc.rect(left, top, historyTableWidth, headerHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Date", left + 8, top + 13);
      doc.text(columns.detailLabel, left + columns.dateWidth + 8, top + 13);
      doc.text("Amount", left + columns.dateWidth + columns.detailWidth + columns.amountWidth - 8, top + 13, { align: "right" });
    };

    const drawHistoryRow = (
      left: number,
      top: number,
      index: number,
      columns: { dateWidth: number; detailWidth: number; amountWidth: number },
      row: { date: string; detail: string; amount: number },
    ) => {
      if (index % 2 === 0) {
        doc.setFillColor(...rowAltColor);
        doc.rect(left, top, historyTableWidth, bodyRowHeight, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...textColor.dark);
      doc.text(row.date, left + 8, top + 12);
      doc.text(fitText(row.detail, columns.detailWidth - 16), left + columns.dateWidth + 8, top + 12);
      doc.text(money(row.amount), left + columns.dateWidth + columns.detailWidth + columns.amountWidth - 8, top + 12, { align: "right" });
      doc.setDrawColor(...borderColor);
      doc.line(left, top + bodyRowHeight, left + historyTableWidth, top + bodyRowHeight);
    };

    const drawHistoryPageHeader = () => {
      doc.addPage();
      drawPageHeader("Transaction History");
      currentY = 108;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...textColor.dark);
      doc.text("Cost History", costTableLeft, currentY + 12);
      doc.text("Paid History", paidTableLeft, currentY + 12);
      currentY += 22;
    };

    const costColumns = {
      dateWidth: 72,
      amountWidth: 78,
      detailWidth: historyTableWidth - 72 - 78,
      detailLabel: "Item Name",
    };
    const paidColumns = {
      dateWidth: 72,
      amountWidth: 78,
      detailWidth: historyTableWidth - 72 - 78,
      detailLabel: "Member",
    };
    const sortedCosts = [...costs].sort((a, b) => a.date.localeCompare(b.date));
    const sortedDeposits = [...deposits].sort((a, b) => a.date.localeCompare(b.date));
    const maxHistoryRows = Math.max(sortedCosts.length, sortedDeposits.length);

    let costPageRowIndex = 0;
    let paidPageRowIndex = 0;
    for (let rowIndex = 0; rowIndex < maxHistoryRows; rowIndex += 1) {
      if (rowIndex === 0) {
        if (costs.length > 0) drawHistoryHeader(costTableLeft, currentY, costColumns);
        if (deposits.length > 0) drawHistoryHeader(paidTableLeft, currentY, paidColumns);
        currentY += headerHeight;
      } else if (currentY + bodyRowHeight > bottomLimit) {
        drawHistoryPageHeader();
        if (costs.length > rowIndex) drawHistoryHeader(costTableLeft, currentY, costColumns);
        if (deposits.length > rowIndex) drawHistoryHeader(paidTableLeft, currentY, paidColumns);
        currentY += headerHeight;
        costPageRowIndex = 0;
        paidPageRowIndex = 0;
      }

      const cost = sortedCosts[rowIndex];
      const deposit = sortedDeposits[rowIndex];
      if (cost) {
        drawHistoryRow(costTableLeft, currentY, costPageRowIndex, costColumns, {
          date: cost.date,
          detail: cost.itemName,
          amount: cost.amount,
        });
        costPageRowIndex += 1;
      }
      if (deposit) {
        drawHistoryRow(paidTableLeft, currentY, paidPageRowIndex, paidColumns, {
          date: deposit.date,
          detail: memberNameById(deposit.memberId),
          amount: deposit.amount,
        });
        paidPageRowIndex += 1;
      }

      currentY += bodyRowHeight;
    }
  }

  if (outputType === "base64") {
    const dataUri = doc.output("datauristring");
    return dataUri.split(",")[1];
  }
  doc.save(fileName || `${groupName}_${chartLabel}_Report.pdf`);
}
