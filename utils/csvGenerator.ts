import { FileEvaluationResult } from '../types';

/**
 * Escapes a cell for CSV format by adding quotes if it contains commas, quotes, or newlines.
 * @param cell The string or number to escape.
 * @returns The CSV-safe string.
 */
function escapeCsvCell(cell: string | number): string {
  const cellStr = String(cell);
  if (/[",\n]/.test(cellStr)) {
    // Wrap in double quotes and double up any existing double quotes.
    return `"${cellStr.replace(/"/g, '""')}"`;
  }
  return cellStr;
}

/**
 * Generates and downloads a CSV report of all student evaluations.
 * @param results An array of FileEvaluationResult objects.
 */
export function generateCsvReport(results: FileEvaluationResult[]): void {
  const validResults = results.filter(r => r.data);
  if (validResults.length === 0) {
    alert("No evaluation data available to export.");
    return;
  }

  // Use the first valid result's criteria to build dynamic headers.
  const firstResultData = validResults[0].data!;
  const criteriaHeaders = firstResultData.detailedBreakdown.map(
    (item) => `${item.criterion} (Score)`
  );

  const headers = [
    'Student Name',
    'Roll No',
    'Overall Score',
    'Max Score',
    ...criteriaHeaders,
  ];

  const rows = results.map((result) => {
    // Handle files that resulted in an error
    if (result.error || !result.data) {
      const errorRow = Array(headers.length).fill('ERROR');
      errorRow[0] = result.studentName || result.fileName;
      errorRow[1] = result.studentRollNo || 'N/A';
      errorRow[2] = result.error || 'Evaluation failed';
      return errorRow;
    }

    // Map scores to criterion names for easy lookup
    const scoresByCriterion = new Map<string, number>();
    result.data.detailedBreakdown.forEach((item) => {
      scoresByCriterion.set(item.criterion, item.score);
    });

    return [
      result.studentName || 'N/A',
      result.studentRollNo || 'N/A',
      result.data.overallScore,
      result.data.maxScore,
      // Ensure scores are in the same order as the headers
      ...firstResultData.detailedBreakdown.map(
        (item) => scoresByCriterion.get(item.criterion) ?? 0
      ),
    ];
  });

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');

  // Create a Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'Evaluation_Marks_Breakdown.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
