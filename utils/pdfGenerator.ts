// These are globally available from the CDN scripts in index.html
declare const jspdf: any;

import { FileEvaluationResult, ReportDetails } from '../types';

const COLORS = [
  '#1976D2', '#FFC107', '#4CAF50', '#F44336', '#9C27B0', 
  '#00BCD4', '#FF9800', '#8BC34A', '#E91E63', '#673AB7'
];

/**
 * Generates a high-quality, text-based PDF report from evaluation data.
 * @param result The full result object for a file evaluation.
 * @param reportDetails The details about the evaluator and assignment.
 * @param fileName The desired name for the downloaded PDF file.
 * @param outputType Defines whether to save the file or return a blob.
 * @returns A promise that resolves to void (for saving) or a Blob.
 */
export async function generatePdfReport(
  result: FileEvaluationResult,
  reportDetails: ReportDetails,
  fileName: string,
  outputType: 'save' | 'blob' = 'save'
): Promise<void | Blob> {
  const { data, studentName = 'N/A', studentRollNo = 'N/A' } = result;

  if (!data) {
    alert("Cannot generate report: Evaluation data is missing.");
    if (outputType === 'blob') return undefined;
    return;
  }

  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const MARGIN = 15;
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
    const FOOTER_SPACE = 20;

    const BRAND_PRIMARY = '#0D47A1';
    const TEXT_PRIMARY = '#111827';
    const TEXT_SECONDARY = '#4B5563';
    const BORDER_COLOR = '#E5E7EB';

    let y = MARGIN;

    const checkPageBreak = (spaceNeeded: number) => {
      if (y + spaceNeeded > PAGE_HEIGHT - FOOTER_SPACE) {
        doc.addPage();
        y = MARGIN;
      }
    };
    
    // --- Header ---
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(BRAND_PRIMARY);
    doc.text('Evaluation Report', MARGIN, y);
    
    doc.setFontSize(20);
    doc.text(`${data.overallScore}/${data.maxScore}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 8;

    if (reportDetails.assignmentName) {
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(TEXT_PRIMARY);
        doc.text(reportDetails.assignmentName, MARGIN, y);
        y += 6;
    }

    const subHeaderParts = [];
    if (reportDetails.courseName) subHeaderParts.push(`Course: ${reportDetails.courseName}`);
    if (reportDetails.institution) subHeaderParts.push(`Institution: ${reportDetails.institution}`);

    if (subHeaderParts.length > 0) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(TEXT_SECONDARY);
        doc.text(subHeaderParts.join('  |  '), MARGIN, y);
        y += 6;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_SECONDARY);
    doc.text(`Student: ${studentName}`, MARGIN, y);
    doc.text(`Roll No: ${studentRollNo}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
    y += 6;

    doc.setDrawColor(BORDER_COLOR);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 10;
    
    // --- Summary and Score Distribution (Two Columns) ---
    checkPageBreak(80); // Estimate height for this section
    const summaryAndPieYStart = y;
    let summaryYEnd = summaryAndPieYStart;
    let pieChartYEnd = summaryAndPieYStart;

    // --- Left Column: Summary Feedback ---
    const summaryWidth = MAX_WIDTH * 0.6 - 5;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY);
    doc.text('Summary Feedback', MARGIN, summaryYEnd);
    summaryYEnd += 7;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_PRIMARY);
    const summaryLines = doc.splitTextToSize(data.summaryFeedback, summaryWidth);
    doc.text(summaryLines, MARGIN, summaryYEnd, { lineHeightFactor: 1.4 });
    summaryYEnd += summaryLines.length * 4 * 1.4;

    // --- Right Column: Score Distribution Pie Chart ---
    const pieChartX = MARGIN + summaryWidth + 10;
    const pieChartWidth = MAX_WIDTH - summaryWidth - 10;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY);
    doc.text('Score Distribution', pieChartX + pieChartWidth/2, pieChartYEnd, { align: 'center' });
    pieChartYEnd += 10;

    const totalMaxScore = data.detailedBreakdown.reduce((sum, item) => sum + item.maxScore, 0);
    if (totalMaxScore > 0) {
      const cx = pieChartX + pieChartWidth / 2;
      const cy = pieChartYEnd + 25;
      const radius = 25;
      
      let startAngle = -90; // Start from the top, in degrees
      data.detailedBreakdown.forEach((item, index) => {
        const sliceAngle = (item.maxScore / totalMaxScore) * 360;
        const endAngle = startAngle + sliceAngle;
        
        doc.setFillColor(COLORS[index % COLORS.length]);

        // Manual Pie Slice Drawing using doc.lines to form a polygon
        const numSegments = 30; // More segments for a smoother curve
        const angleStep = (endAngle - startAngle) / numSegments;
        const lineSegments = [];

        // First point of the arc
        let lastX = cx + radius * Math.cos(startAngle * Math.PI / 180);
        let lastY = cy + radius * Math.sin(startAngle * Math.PI / 180);

        // The doc.lines command starts from (cx,cy). First line is to the arc's start.
        lineSegments.push([lastX - cx, lastY - cy]);

        // Create segments for the arc
        for (let i = 1; i <= numSegments; i++) {
            const currentAngle = startAngle + i * angleStep;
            const currentX = cx + radius * Math.cos(currentAngle * Math.PI / 180);
            const currentY = cy + radius * Math.sin(currentAngle * Math.PI / 180);
            lineSegments.push([currentX - lastX, currentY - lastY]);
            lastX = currentX;
            lastY = currentY;
        }

        // The 'closed' parameter will draw a line from the last point back to the start (cx, cy)
        doc.lines(lineSegments, cx, cy, [1, 1], 'F', true);
        
        startAngle = endAngle;
      });
      pieChartYEnd = cy + radius + 8; // Update y pos after chart

      // Draw Legend
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      data.detailedBreakdown.forEach((item, index) => {
        checkPageBreak(5); // check break for each legend item
        doc.setFillColor(COLORS[index % COLORS.length]);
        doc.rect(pieChartX, pieChartYEnd - 1, 3, 3, 'F');
        doc.setTextColor(TEXT_SECONDARY);
        const legendText = doc.splitTextToSize(`${item.criterion} (${item.maxScore} pts)`, pieChartWidth - 5);
        doc.text(legendText, pieChartX + 5, pieChartYEnd + 2.5);
        pieChartYEnd += (legendText.length * 3) + 2;
      });
    }

    y = Math.max(summaryYEnd, pieChartYEnd) + 10;

    // --- Detailed Breakdown ---
    checkPageBreak(20);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY);
    doc.text('Detailed Breakdown', MARGIN, y);
    y += 8;

    data.detailedBreakdown.forEach(item => {
        const feedbackLines = doc.splitTextToSize(item.feedback, MAX_WIDTH - 6);
        const itemHeight = 9 + 4 + (feedbackLines.length * 4 * 1.4) + 8;
        checkPageBreak(itemHeight);

        doc.setFillColor('#F3F4F6');
        doc.roundedRect(MARGIN, y, MAX_WIDTH, 9, 2, 2, 'F');
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(TEXT_PRIMARY);
        doc.text(item.criterion, MARGIN + 3, y + 6);
        doc.text(`${item.score} / ${item.maxScore}`, PAGE_WIDTH - MARGIN - 3, y + 6, { align: 'right' });
        y += 9;

        y += 4;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(TEXT_SECONDARY);
        doc.text(feedbackLines, MARGIN + 3, y, { lineHeightFactor: 1.4 });
        y += (feedbackLines.length * 4 * 1.4) + 8;
    });

    // --- Additional Checks ---
    if (data.similarityCheck || data.aiContentCheck) {
        checkPageBreak(20);
        y += 5;
        doc.setDrawColor(BORDER_COLOR);
        doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
        y += 10;

        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(BRAND_PRIMARY);
        doc.text('Additional Checks', MARGIN, y);
        y += 8;

        if (data.similarityCheck) {
            checkPageBreak(25);
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(TEXT_PRIMARY);
            doc.text('Similarity & Plagiarism Check', MARGIN, y);
            doc.setFont('times', 'normal');
            doc.text(`Score: ${data.similarityCheck.score}%`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
            y += 6;

            const simSummaryLines = doc.splitTextToSize(data.similarityCheck.summary, MAX_WIDTH);
            doc.setFontSize(10);
            doc.setTextColor(TEXT_SECONDARY);
            doc.text(simSummaryLines, MARGIN, y, { lineHeightFactor: 1.4 });
            y += (simSummaryLines.length * 4 * 1.4) + 8;
        }

        if (data.aiContentCheck) {
            checkPageBreak(25);
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(TEXT_PRIMARY);
            doc.text('AI Content Detection', MARGIN, y);
            doc.setFont('times', 'normal');
            doc.text(`Likelihood: ${data.aiContentCheck.likelihood}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
            y += 6;

            const aiSummaryLines = doc.splitTextToSize(data.aiContentCheck.summary, MAX_WIDTH);
            doc.setFontSize(10);
            doc.setTextColor(TEXT_SECONDARY);
            doc.text(aiSummaryLines, MARGIN, y, { lineHeightFactor: 1.4 });
            y += (aiSummaryLines.length * 4 * 1.4) + 8;
        }
    }

    // --- Disclaimer & Signature ---
    const disclaimerText = "Disclosure of AI-Assisted Evaluation: Please be advised that an AI-powered Large Language Model (LLM) was utilized as a preliminary tool in the generation of this evaluation report. The undersigned evaluator has subsequently conducted a thorough manual review, making all necessary revisions and corrections. The final assessment, including all qualitative feedback and the assigned grade, represents the evaluator's final and considered professional judgment.";
    const disclaimerLines = doc.splitTextToSize(disclaimerText, MAX_WIDTH);
    const disclaimerHeight = (disclaimerLines.length * 3.5 * 1.5) + 10;
    const signatureHeight = 25;

    checkPageBreak(disclaimerHeight + signatureHeight);
    y += 5;
    doc.setDrawColor(BORDER_COLOR);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 10;

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_SECONDARY);
    doc.text(disclaimerLines, MARGIN, y, { lineHeightFactor: 1.5 });
    y += disclaimerHeight;
    
    // Signature
    y += 10;
    const signatureX = MARGIN;
    doc.setDrawColor(TEXT_PRIMARY);
    doc.line(signatureX, y, signatureX + 70, y); // Signature line
    y += 5;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_PRIMARY);
    if (reportDetails.evaluatorName) doc.text(reportDetails.evaluatorName, signatureX, y);
    y += 4;
    
    doc.setFont('times', 'normal');
    if (reportDetails.evaluatorDesignation) doc.text(reportDetails.evaluatorDesignation, signatureX, y);

    // --- Page Numbering ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#6B7280');
        doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
    }

    // --- Output ---
    if (outputType === 'blob') {
        return doc.output('blob');
    } else {
        doc.save(fileName);
    }

  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("An error occurred while generating the PDF report.");
    throw error;
  }
}