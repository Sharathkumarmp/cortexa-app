import React, { useState, useCallback } from 'react';
import { FileEvaluationResult, EvaluationResult, ReportDetails } from './types';
import { evaluateAssignment, generateRubric } from './services/geminiService';
import { extractTextFromPdf } from './utils/pdfReader';
import { extractTextFromImage } from './utils/imageReader';
import { parseStudentInfo } from './utils/fileParser';
import { generateCsvReport } from './utils/csvGenerator';
import { generatePdfReport } from './utils/pdfGenerator';
import Loader from './components/Loader';
import AccordionItem from './components/AccordionItem';

declare const JSZip: any;

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [rubric, setRubric] = useState<string>('');
  const [results, setResults] = useState<FileEvaluationResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [checkSimilarity, setCheckSimilarity] = useState(false);
  const [checkAIContent, setCheckAIContent] = useState(false);
  const [reportDetails, setReportDetails] = useState<ReportDetails>({
    evaluatorName: '',
    evaluatorDesignation: '',
    institution: '',
    assignmentName: '',
    courseName: '',
  });

  // State for Rubric Generation Modal
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [rubricGenerationError, setRubricGenerationError] = useState<string | null>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (newFiles) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const validFiles = Array.from(newFiles).filter(file => allowedTypes.includes(file.type));
      setFiles(prev => {
        const existingFileNames = new Set(prev.map(f => f.name));
        const uniqueNewFiles = validFiles.filter(f => !existingFileNames.has(f.name));
        return [...prev, ...uniqueNewFiles];
      });
      setError(null);
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
  
  const handleReportDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReportDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleEvaluate = useCallback(async () => {
    if (files.length === 0 || !rubric.trim()) {
      setError('Please upload at least one assignment file and provide the evaluation rubric.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    const newResults: FileEvaluationResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { name: studentName, rollNo: studentRollNo } = parseStudentInfo(file.name);
      
      try {
        let assignmentText = '';
        
        if (file.type === 'application/pdf') {
            setProgress(`Extracting text from PDF: ${file.name}`);
            assignmentText = await extractTextFromPdf(file);
        } else if (file.type === 'image/jpeg' || file.type === 'image/png') {
            assignmentText = await extractTextFromImage(file, (p: any) => {
                const statusMessage = p.status.replace(/_/g, ' '); // a nice status message
                setProgress(`OCR on ${file.name}: ${statusMessage} (${Math.round(p.progress * 100)}%)`);
            });
        } else {
            throw new Error(`Unsupported file type: ${file.type}`);
        }

        if(!assignmentText.trim()){
            throw new Error("Could not extract text from file. The file might be empty or unreadable.");
        }

        setProgress(`Evaluating ${file.name} with AI...`);
        const evaluation = await evaluateAssignment(assignmentText, rubric, checkSimilarity, checkAIContent);
        newResults.push({ fileName: file.name, studentName, studentRollNo, data: evaluation, error: null });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        newResults.push({ fileName: file.name, studentName, studentRollNo, data: null, error: `Failed to evaluate: ${errorMessage}` });
      } finally {
        setResults([...newResults]);
      }
    }
    setIsLoading(false);
    setProgress(null);
  }, [files, rubric, checkSimilarity, checkAIContent]);

  const handleClear = () => {
    setFiles([]);
    setRubric('');
    setResults([]);
    setError(null);
    setIsLoading(false);
    setProgress(null);
    setCheckSimilarity(false);
    setCheckAIContent(false);
    setReportDetails({
      evaluatorName: '',
      evaluatorDesignation: '',
      institution: '',
      assignmentName: '',
      courseName: '',
    });
  };

  const handleGenerateRubric = async () => {
    if (!assignmentDescription.trim()) return;
    setIsGeneratingRubric(true);
    setRubricGenerationError(null);
    try {
      const generatedRubric = await generateRubric(assignmentDescription);
      setRubric(generatedRubric);
      closeRubricModal();
    } catch (err) {
      setRubricGenerationError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsGeneratingRubric(false);
    }
  };
  
  const handleUpdateResult = (fileName: string, updatedData: EvaluationResult) => {
    setResults(prevResults =>
      prevResults.map(r =>
        r.fileName === fileName ? { ...r, data: updatedData, error: null } : r
      )
    );
  };

  const closeRubricModal = () => {
    setIsRubricModalOpen(false);
    setAssignmentDescription('');
    setRubricGenerationError(null);
  };
  
  const handleDownloadAllPdfs = async () => {
    const validResults = results.filter(r => r.data);
    if (validResults.length === 0) {
        alert("No valid reports to download.");
        return;
    }

    setIsZipping(true);
    setError(null);

    try {
        const zip = new JSZip();
        
        for (const res of validResults) {
            const pdfFileName = `Evaluation_Report_${res.studentName || 'Unknown'}_${res.studentRollNo || '0000'}.pdf`;
            const pdfBlob = await generatePdfReport(res, reportDetails, pdfFileName, 'blob');
            if (pdfBlob) {
                zip.file(pdfFileName, pdfBlob);
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        const url = URL.createObjectURL(zipBlob);
        link.href = url;
        link.download = 'All_Evaluation_Reports.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error creating zip file:", err);
        setError("Failed to create the zip file of reports. Please try downloading them individually.");
    } finally {
        setIsZipping(false);
    }
  };

  const rubricPlaceholder = `1. Clarity of Thesis (10 points): The main argument is clear, concise, and well-defined.
2. Evidence and Support (30 points): Claims are supported by relevant, credible evidence.
3. Analysis and Argumentation (30 points): The essay demonstrates critical thinking and logical reasoning.
4. Structure and Organization (20 points): The essay is well-organized with a logical flow.
5. Grammar and Style (10 points): The writing is free of grammatical errors and demonstrates a professional style.`;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-gradient-to-r from-brand-dark to-brand-primary shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
           <div className="flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
                    Cortexa
                </h1>
                <p className="text-sm text-indigo-200 tracking-wider hidden sm:block">AI-Powered Assignment Evaluator</p>
             </div>
           </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl mb-8 animate-slide-in-up">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">Report Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 mt-4">
              <div className="md:col-span-2">
                  <label htmlFor="assignmentName" className="block text-sm font-medium text-slate-700">Assignment Name</label>
                  <input type="text" name="assignmentName" id="assignmentName" value={reportDetails.assignmentName} onChange={handleReportDetailsChange} className="mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition duration-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm" placeholder="e.g., Final Year Project Report" />
              </div>
              <div>
                  <label htmlFor="courseName" className="block text-sm font-medium text-slate-700">Course Name (optional)</label>
                  <input type="text" name="courseName" id="courseName" value={reportDetails.courseName} onChange={handleReportDetailsChange} className="mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition duration-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm" placeholder="e.g., Advanced Programming" />
              </div>
              <div>
                  <label htmlFor="institution" className="block text-sm font-medium text-slate-700">Institution</label>
                  <input type="text" name="institution" id="institution" value={reportDetails.institution} onChange={handleReportDetailsChange} className="mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition duration-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm" placeholder="e.g., University of Technology" />
              </div>
              <div>
                  <label htmlFor="evaluatorName" className="block text-sm font-medium text-slate-700">Evaluator's Name</label>
                  <input type="text" name="evaluatorName" id="evaluatorName" value={reportDetails.evaluatorName} onChange={handleReportDetailsChange} className="mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition duration-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm" placeholder="e.g., Dr. Jane Doe" />
              </div>
              <div>
                  <label htmlFor="evaluatorDesignation" className="block text-sm font-medium text-slate-700">Evaluator's Designation</label>
                  <input type="text" name="evaluatorDesignation" id="evaluatorDesignation" value={reportDetails.evaluatorDesignation} onChange={handleReportDetailsChange} className="mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm transition duration-200 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm" placeholder="e.g., Professor of Computer Science" />
              </div>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl mb-8 animate-slide-in-up" style={{ animationDelay: '100ms' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <label className="block text-lg font-semibold text-slate-700 mb-2">Student Assignments (PDF, JPG, PNG)</label>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`w-full h-80 p-4 border-2 border-dashed rounded-xl flex flex-col justify-center items-center text-center transition-all duration-300 ${isDragging ? 'border-brand-primary bg-brand-light ring-2 ring-brand-primary' : 'border-slate-300 bg-slate-50 hover:border-brand-secondary'}`}
              >
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer p-4 rounded-full transition-colors hover:bg-brand-light">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  <p className="text-slate-600 mt-2 font-semibold">Drag & Drop files here (PDF, JPG, PNG)</p>
                  <p className="text-sm text-slate-500">or</p>
                  <span className="font-semibold text-brand-primary hover:underline">Click to browse</span>
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto pr-2">
                  <h4 className="font-semibold text-slate-600 mb-2">Selected Files:</h4>
                  <ul className="space-y-2">
                    {files.map(file => (
                      <li key={file.name} className="flex justify-between items-center bg-slate-100 p-2 rounded-lg text-sm">
                        <span className="truncate">{file.name}</span>
                        <button onClick={() => removeFile(file.name)} className="text-red-500 hover:text-red-700 ml-2" aria-label={`Remove ${file.name}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
               <div className="flex justify-between items-center mb-2">
                 <label htmlFor="rubric" className="block text-lg font-semibold text-slate-700">Evaluation Rubric</label>
                 <button 
                   onClick={() => setIsRubricModalOpen(true)} 
                   className="flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-dark transition-colors duration-200"
                   aria-label="Generate rubric with AI"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                   </svg>
                   Generate with AI
                 </button>
               </div>
              <textarea
                id="rubric"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder={rubricPlaceholder}
                className="w-full h-80 p-4 border border-slate-300 bg-slate-50 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition duration-200"
                aria-label="Evaluation Rubric Input"
              />
            </div>
          </div>
          <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-slate-700 mb-3">Additional Checks</h3>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                          type="checkbox"
                          checked={checkSimilarity}
                          onChange={(e) => setCheckSimilarity(e.target.checked)}
                          className="h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary focus:ring-offset-2"
                      />
                      <span className="text-slate-700">Similarity & Plagiarism Check</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                          type="checkbox"
                          checked={checkAIContent}
                          onChange={(e) => setCheckAIContent(e.target.checked)}
                          className="h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary focus:ring-offset-2"
                      />
                      <span className="text-slate-700">AI Content Detection</span>
                  </label>
              </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleEvaluate}
              disabled={isLoading || isZipping}
              className="w-full sm:w-auto bg-brand-primary hover:bg-brand-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center justify-center"
              aria-busy={isLoading}
            >
              {isLoading ? 'Evaluating...' : 'Evaluate Assignments'}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading || isZipping}
              className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-700 font-bold py-3 px-8 rounded-lg transition-colors duration-300 disabled:opacity-50 border border-slate-300 shadow-sm"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="mt-8" role="status" aria-live="polite">
          {isLoading && <Loader message={progress} />}
          {error && <div className="text-center text-red-600 bg-red-100 p-4 rounded-lg animate-fade-in">{error}</div>}
          {results.length > 0 && !isLoading && (
            <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4 border-b pb-2 gap-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Evaluation Results</h2>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => generateCsvReport(results)}
                            className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 px-4 border border-slate-300 rounded-lg shadow-sm transition-colors duration-200"
                            aria-label="Download all results as CSV"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download as CSV
                        </button>
                        <button
                            onClick={handleDownloadAllPdfs}
                            disabled={isZipping}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-dark text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-slate-400"
                            aria-label="Download all reports as a ZIP file"
                            aria-busy={isZipping}
                        >
                            {isZipping ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Zipping...</span>
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Download All Reports (ZIP)</span>
                                </>
                            )}
                        </button>
                    </div>
                 </div>
                {results.map((res) => (
                    <AccordionItem key={res.fileName} result={res} onUpdateResult={handleUpdateResult} reportDetails={reportDetails} />
                ))}
            </div>
          )}
        </div>
      </main>

      {isRubricModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in" aria-modal="true" role="dialog" onClick={closeRubricModal}>
          <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-lg m-4 animate-slide-in-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Generate Rubric with AI</h2>
            <p className="text-slate-600 mb-4">Describe the assignment, and the AI will create a starting rubric for you. You can edit it afterward.</p>
            <textarea
              value={assignmentDescription}
              onChange={(e) => setAssignmentDescription(e.target.value)}
              placeholder="e.g., A 5-page research paper on the causes of World War II, focusing on primary sources and demonstrating critical analysis."
              className="w-full h-32 p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-primary"
              aria-label="Assignment Description"
              autoFocus
            />
            {rubricGenerationError && <p className="text-red-600 mt-2 text-sm animate-fade-in">{rubricGenerationError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeRubricModal} className="py-2 px-5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleGenerateRubric}
                disabled={isGeneratingRubric || !assignmentDescription.trim()}
                className="py-2 px-5 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center w-32 transition-colors"
              >
                {isGeneratingRubric ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;