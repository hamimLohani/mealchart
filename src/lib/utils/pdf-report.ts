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

  drawPageHeader();

  const rowMemberIds = memberIdsForChartRows(members, meals, monthKey);

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

  const tableTop = summaryTop + cardHeight + 28;
  const mealMap: Record<string, Record<string, number>> = {};
  meals.forEach((meal) => {
    const memberId = meal.memberId.toLowerCase();
    mealMap[memberId] = mealMap[memberId] ?? {};
    mealMap[memberId][meal.date] = normalizeMealQuantity(meal.quantity);
  });

  const nameWidth = 122;
  const totalWidth = 40;
  const paidWidth = 54;
  const balanceWidth = 58;
  const dayWidth = (contentWidth - nameWidth - totalWidth - paidWidth - balanceWidth) / totalDays;
  const tableWidth = nameWidth + totalDays * dayWidth + totalWidth + paidWidth + balanceWidth;
  const tableLeft = margin;
  const headerHeight = 24;
  const bodyRowHeight = 21;
  const bottomLimit = pageHeight - margin;

  const drawTableHeader = (top: number) => {
    doc.setFillColor(...headerColor);
    doc.rect(tableLeft, top, tableWidth, headerHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let x = tableLeft;
    doc.text("Member", x + 8, top + 15);
    x += nameWidth;
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const label = String(dayIndex + 1);
      doc.text(label, x + dayWidth / 2, top + 15, { align: "center" });
      x += dayWidth;
    }
    doc.text("Meals", x + totalWidth / 2, top + 15, { align: "center" });
    x += totalWidth;
    doc.text("Paid", x + paidWidth / 2, top + 15, { align: "center" });
    x += paidWidth;
    doc.text("Balance", x + balanceWidth / 2, top + 15, { align: "center" });

    doc.setDrawColor(51, 65, 85);
    doc.line(tableLeft + nameWidth, top, tableLeft + nameWidth, top + headerHeight);
    doc.line(tableLeft + tableWidth - paidWidth - balanceWidth, top, tableLeft + tableWidth - paidWidth - balanceWidth, top + headerHeight);
    doc.line(tableLeft + tableWidth - balanceWidth, top, tableLeft + tableWidth - balanceWidth, top + headerHeight);
  };

  let currentY = tableTop;
  drawTableHeader(currentY);
  currentY += headerHeight;

  const addPageAndHeader = () => {
    doc.addPage();
    drawPageHeader("Meal Chart Report");
    currentY = 108;
    drawTableHeader(currentY);
    currentY += headerHeight;
  };

  rowMemberIds.forEach((memberId, rowIndex) => {
    if (currentY + bodyRowHeight > bottomLimit) {
      addPageAndHeader();
    }

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
    doc.text(fitText(memberName, nameWidth - 12), tableLeft + 8, currentY + 14);

    let x = tableLeft + nameWidth;
    const memberTotals = getMemberTotals(memberId, meals, deposits, totals.mealRate);

    doc.setFontSize(7);
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
      const dayKey = days[dayIndex];
      const value = mealMap[memberId]?.[dayKey];
      if (value) {
        doc.text(formatMeal(value), x + dayWidth / 2, currentY + 14, { align: "center" });
      }
      x += dayWidth;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(formatMeal(memberTotals.totalMeals), x + totalWidth / 2, currentY + 14, { align: "center" });
    x += totalWidth;
    doc.setFont("helvetica", "normal");
    doc.text(memberTotals.totalPaid.toFixed(1), x + paidWidth / 2, currentY + 14, { align: "center" });
    x += paidWidth;

    const balance = memberTotals.balance;
    if (balance < 0) {
      doc.setTextColor(185, 28, 28); // Red
    } else if (balance > 0) {
      doc.setTextColor(21, 128, 61); // Green
    }
    doc.text(balance.toFixed(1), x + balanceWidth / 2, currentY + 14, { align: "center" });
    doc.setTextColor(...textColor.dark); // Reset

    currentY += bodyRowHeight;
  });

  if (currentY + bodyRowHeight > bottomLimit) {
    addPageAndHeader();
  }

  doc.setFillColor(...headerColor);
  doc.rect(tableLeft, currentY, tableWidth, bodyRowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", tableLeft + 8, currentY + 14);
  let x = tableLeft + nameWidth;
  doc.setFontSize(7);
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const dayKey = days[dayIndex];
    const dayTotal = rowMemberIds.reduce((sum, id) => sum + (mealMap[id]?.[dayKey] ?? 0), 0);
    if (dayTotal) {
      doc.text(formatMeal(dayTotal), x + dayWidth / 2, currentY + 14, { align: "center" });
    }
    x += dayWidth;
  }
  doc.setFontSize(8);
  doc.text(formatMeal(totals.totalMeals), x + totalWidth / 2, currentY + 14, { align: "center" });
  x += totalWidth;
  doc.text(totals.totalPaid.toFixed(1), x + paidWidth / 2, currentY + 14, { align: "center" });
  x += paidWidth;
  doc.text(totals.remainingTaka.toFixed(1), x + balanceWidth / 2, currentY + 14, { align: "center" });

  // Detailed Cost and Paid History Section
  currentY += bodyRowHeight + 40;

  if (costs.length > 0 || deposits.length > 0) {
    if (currentY + 60 > bottomLimit) {
      doc.addPage();
      drawPageHeader("Transaction History");
      currentY = 108;
    }

    const historyGap = 24;
    const historyTableWidth = (contentWidth - historyGap) / 2;
    const costTableLeft = margin;
    const paidTableLeft = margin + historyTableWidth + historyGap;
    const sectionTitleY = currentY;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textColor.dark);
    doc.text("Cost History", costTableLeft, sectionTitleY);
    doc.text("Paid History", paidTableLeft, sectionTitleY);

    currentY += 15;
    const historyStartY = currentY;

    const drawHistoryHeader = (
      left: number,
      top: number,
      columns: { dateWidth: number; detailWidth: number; amountWidth: number; detailLabel: string },
    ) => {
      doc.setFillColor(...headerColor);
      doc.rect(left, top, historyTableWidth, headerHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
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
      doc.text(row.date, left + 8, top + 13);
      doc.text(fitText(row.detail, columns.detailWidth - 16), left + columns.dateWidth + 8, top + 13);
      doc.text(money(row.amount), left + columns.dateWidth + columns.detailWidth + columns.amountWidth - 8, top + 13, { align: "right" });
      doc.setDrawColor(...borderColor);
      doc.line(left, top + bodyRowHeight, left + historyTableWidth, top + bodyRowHeight);
    };

    const drawHistoryPageHeader = () => {
      doc.addPage();
      drawPageHeader("Transaction History");
      currentY = 108;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...textColor.dark);
      doc.text("Cost History", costTableLeft, currentY);
      doc.text("Paid History", paidTableLeft, currentY);
      currentY += 15;
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

    if (maxHistoryRows === 0) {
      currentY = historyStartY;
    }

    if (costs.length > 0 && deposits.length === 0 && currentY + bodyRowHeight <= bottomLimit) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...textColor.muted);
      doc.text("No paid history for this month.", paidTableLeft, historyStartY + 13);
    }

    if (deposits.length > 0 && costs.length === 0 && currentY + bodyRowHeight <= bottomLimit) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...textColor.muted);
      doc.text("No cost history for this month.", costTableLeft, historyStartY + 13);
    }

    if (costs.length === 0 && deposits.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...textColor.muted);
      doc.text("No cost or paid history for this month.", margin, currentY);
    }
  }

  doc.save(fileName || `${groupName}_${chartLabel}_Report.pdf`);
}
