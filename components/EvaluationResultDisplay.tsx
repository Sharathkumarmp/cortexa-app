import React, { useState, useEffect } from 'react';
import { EvaluationResult } from '../types';
import ScorePieChart from './ScorePieChart';

const SimilarityProgressBar: React.FC<{ score: number }> = ({ score }) => {
  let barColor = 'bg-green-500';
  if (score > 25) barColor = 'bg-yellow-500';
  if (score > 50) barColor = 'bg-orange-500';
  if (score > 75) barColor = 'bg-red-500';

  return (
    <div className="w-full bg-slate-200 rounded-full h-2.5 my-1">
      <div
        className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
        style={{ width: `${score}%` }}
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      ></div>
    </div>
  );
};

const AILikelihoodBadge: React.FC<{ likelihood: string }> = ({ likelihood }) => {
    let colorClass = 'bg-slate-100 text-slate-800';
    switch (likelihood.toLowerCase()) {
        case 'high':
            colorClass = 'bg-red-100 text-red-800';
            break;
        case 'medium':
            colorClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'low':
            colorClass = 'bg-green-100 text-green-800';
            break;
    }
    return <span className={`px-3 py-1 text-sm font-semibold rounded-full ${colorClass}`}>{likelihood}</span>
}

interface Props {
    result: EvaluationResult;
    studentName?: string;
    studentRollNo?: string;
    reportId: string;
    isEditing: boolean;
    onSave: (updatedResult: EvaluationResult) => void;
    onCancel: () => void;
}

const EvaluationResultDisplay: React.FC<Props> = ({ result, studentName, studentRollNo, reportId, isEditing, onSave, onCancel }) => {
  const [editedResult, setEditedResult] = useState<EvaluationResult>(result);

  useEffect(() => {
    setEditedResult(result);
  }, [result, isEditing]); // Reset form if original result changes or editing is cancelled

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedResult(prev => ({ ...prev, summaryFeedback: e.target.value }));
  };

  const handleBreakdownChange = (index: number, field: 'score' | 'feedback', value: string | number) => {
    const newBreakdown = [...editedResult.detailedBreakdown];
    const item = { ...newBreakdown[index] };

    if (field === 'score') {
        const newScore = Math.max(0, Math.min(Number(value), item.maxScore));
        item.score = isNaN(newScore) ? 0 : newScore;
    } else {
        item.feedback = String(value);
    }
    newBreakdown[index] = item;
    
    const newOverallScore = newBreakdown.reduce((sum, currentItem) => sum + currentItem.score, 0);

    setEditedResult(prev => ({
        ...prev,
        detailedBreakdown: newBreakdown,
        overallScore: newOverallScore,
    }));
  };

  const handleSaveChanges = () => {
    onSave(editedResult);
  };

  return (
    <div id={reportId} className="bg-slate-100 p-6 sm:p-8 rounded-b-2xl w-full text-slate-900 animate-slide-in-up">
      {/* --- Header --- */}
      <div className="flex justify-between items-start pb-4 border-b-2 border-slate-200">
        <div>
          <h2 className="text-3xl font-bold text-brand-dark">Evaluation Report</h2>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold text-slate-800">
            {editedResult.overallScore}<span className="text-2xl text-slate-700"> / {editedResult.maxScore}</span>
          </p>
          <p className="text-sm font-semibold text-slate-600">Overall Score</p>
        </div>
      </div>
      <div className="flex justify-between items-center py-2 bg-slate-200 px-4 rounded-b-md -mx-6 -mt-1 mb-6">
         <p className="text-sm text-slate-800">Student: <span className="font-bold text-slate-900">{studentName || 'N/A'}</span></p>
         <p className="text-sm text-slate-800">Roll No: <span className="font-bold text-slate-900">{studentRollNo || 'N/A'}</span></p>
      </div>

      {/* --- Summary and Score Distribution --- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-bold text-brand-dark mb-2">Summary Feedback</h3>
           {isEditing ? (
              <textarea
                value={editedResult.summaryFeedback}
                onChange={handleSummaryChange}
                className="w-full h-32 p-3 border border-slate-300 rounded-lg shadow-inner bg-slate-50 focus:ring-brand-primary focus:border-brand-primary"
                aria-label="Edit Summary Feedback"
              />
            ) : (
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{editedResult.summaryFeedback}</p>
            )}
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-bold text-brand-dark mb-2 text-center">Score Distribution</h3>
          <ScorePieChart breakdown={editedResult.detailedBreakdown} />
        </div>
      </div>
      
      {/* --- Detailed Breakdown --- */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-brand-dark mb-3">Detailed Breakdown</h3>
        <div className="space-y-4">
          {editedResult.detailedBreakdown.map((item, index) => (
            <div key={index} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-slate-50 border-b border-slate-200">
                <h4 className="text-md font-bold text-slate-900 flex-1">{item.criterion}</h4>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={item.score}
                            onChange={(e) => handleBreakdownChange(index, 'score', e.target.value)}
                            max={item.maxScore}
                            min={0}
                            className="w-24 p-1.5 border border-slate-300 rounded-md text-center bg-slate-50 shadow-inner focus:ring-brand-primary focus:border-brand-primary"
                            aria-label={`Edit score for ${item.criterion}`}
                        />
                        <span className="text-md font-semibold text-slate-600"> / {item.maxScore}</span>
                    </div>
                ) : (
                    <span className="text-md font-semibold text-brand-primary bg-brand-light px-4 py-1 rounded-full self-start sm:self-center">
                    {item.score} / {item.maxScore}
                    </span>
                )}
              </div>
               {isEditing ? (
                    <textarea
                        value={item.feedback}
                        onChange={(e) => handleBreakdownChange(index, 'feedback', e.target.value)}
                        className="w-full h-24 p-4 text-sm leading-6 border-t-0 rounded-b-md bg-slate-50 focus:ring-brand-primary focus:border-brand-primary focus:ring-1"
                        aria-label={`Edit feedback for ${item.criterion}`}
                    />
                ) : (
                    <p className="text-slate-700 whitespace-pre-wrap p-4 text-sm leading-6">{item.feedback}</p>
                )}
            </div>
          ))}
        </div>
      </div>
      
      {/* --- Additional Checks --- */}
      {(result.similarityCheck || result.aiContentCheck) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {result.similarityCheck && (
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-bold text-brand-dark mb-2">Similarity & Plagiarism Check</h3>
              <div className="flex items-center justify-between gap-4 my-2">
                <span className="font-semibold text-slate-800">Similarity Score:</span>
                <span className="text-xl font-bold text-red-500">{result.similarityCheck.score}%</span>
              </div>
              <SimilarityProgressBar score={result.similarityCheck.score} />
              <p className="text-slate-700 whitespace-pre-wrap mt-3 text-sm">{result.similarityCheck.summary}</p>
            </div>
          )}
          {result.aiContentCheck && (
            <div className="bg-white p-6 rounded-xl shadow">
              <h3 className="text-lg font-bold text-brand-dark mb-2">AI Content Detection</h3>
              <div className="flex items-center justify-between gap-4 my-2">
                <span className="font-semibold text-slate-800">Likelihood of AI Generation:</span>
                <AILikelihoodBadge likelihood={result.aiContentCheck.likelihood} />
              </div>
              <p className="text-slate-700 whitespace-pre-wrap mt-3 text-sm">{result.aiContentCheck.summary}</p>
            </div>
          )}
        </div>
      )}

       {isEditing && (
        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="py-2 px-5 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            className="py-2 px-5 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-dark transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default EvaluationResultDisplay;