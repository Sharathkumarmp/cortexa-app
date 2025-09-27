import React, { useState } from 'react';
import { FileEvaluationResult, EvaluationResult, ReportDetails } from '../types';
import EvaluationResultDisplay from './EvaluationResultDisplay';
import { generatePdfReport } from '../utils/pdfGenerator';


interface Props {
  result: FileEvaluationResult;
  onUpdateResult: (fileName: string, updatedData: EvaluationResult) => void;
  reportDetails: ReportDetails;
}

const AccordionItem: React.FC<Props> = ({ result, onUpdateResult, reportDetails }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'success'>('idle');


  const score = result.data?.overallScore;
  const maxScore = result.data?.maxScore;
  
  const reportId = `report-${result.fileName.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const pdfFileName = `Evaluation_Report_${result.studentName || 'Unknown'}_${result.studentRollNo || '0000'}.pdf`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling when button is clicked
    if (pdfStatus !== 'idle' || !result.data) return;
    setPdfStatus('generating');
    try {
        await generatePdfReport(result, reportDetails, pdfFileName);
        setPdfStatus('success');
    } catch(err) {
        console.error("PDF generation failed:", err);
        setPdfStatus('idle'); // Reset on failure
    } finally {
        setTimeout(() => setPdfStatus('idle'), 3000); 
    }
  };

  const handleSave = (updatedData: EvaluationResult) => {
    onUpdateResult(result.fileName, updatedData);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    if (result.error) {
      return <span className="text-xs font-semibold text-white bg-red-500 px-3 py-1 rounded-full">Error</span>;
    }
    if (typeof score === 'number' && typeof maxScore === 'number') {
      const scorePercentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
      let scoreColorClass = 'bg-green-100 text-green-800';
      if (scorePercentage < 75) scoreColorClass = 'bg-yellow-100 text-yellow-800';
      if (scorePercentage < 50) scoreColorClass = 'bg-red-100 text-red-800';
      return <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreColorClass}`}>{score}/{maxScore}</span>;
    }
    return null;
  };

  const renderDownloadButtonContent = () => {
    switch (pdfStatus) {
        case 'generating':
            return (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                </>
            );
        case 'success':
            return (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Downloaded!
                </>
            );
        default: // idle
            return (
                <>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Report
                </>
            );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 animate-fade-in">
      <button
        className="w-full text-left p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate" title={result.fileName}>{result.fileName}</p>
          <p className="text-sm text-slate-500">
            {result.studentName && result.studentRollNo !== 'N/A' ? `${result.studentName} (${result.studentRollNo})` : (result.studentName || 'Student info not available')}
          </p>
        </div>
        <div className="flex items-center gap-4 ml-4">
          {getStatusBadge()}
          <svg
            className={`w-6 h-6 text-slate-400 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="border-t border-slate-200">
          {result.error && (
            <div className="p-4 text-red-700 bg-red-50">{result.error}</div>
          )}
          {result.data && (
              <>
                <div className="p-4 bg-slate-50/70 flex flex-wrap justify-end gap-3">
                    {!isEditing && (
                        <button 
                            onClick={handleDownload}
                            disabled={pdfStatus !== 'idle'}
                            className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors duration-200 ${
                                pdfStatus === 'success' ? 'bg-green-600' : 'bg-brand-primary'
                            } hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:bg-slate-400 disabled:cursor-not-allowed`}
                        >
                            {renderDownloadButtonContent()}
                        </button>
                    )}
                     <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors duration-200 ${
                            isEditing ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-brand-light hover:bg-indigo-200 text-brand-dark font-semibold'
                        }`}
                    >
                        {isEditing ? 'Cancel Edit' : 'Edit Report'}
                    </button>
                </div>
                <EvaluationResultDisplay 
                    result={result.data} 
                    studentName={result.studentName} 
                    studentRollNo={result.studentRollNo} 
                    reportId={reportId}
                    isEditing={isEditing}
                    onSave={handleSave}
                    onCancel={() => setIsEditing(false)}
                />
              </>
          )}
        </div>
      )}
    </div>
  );
};

export default AccordionItem;