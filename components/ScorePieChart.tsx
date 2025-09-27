import React from 'react';
import { CriterionFeedback } from '../types';

interface Props {
  breakdown: CriterionFeedback[];
}

const COLORS = [
  '#1976D2', '#FFC107', '#4CAF50', '#F44336', '#9C27B0', 
  '#00BCD4', '#FF9800', '#8BC34A', '#E91E63', '#673AB7'
];

const ScorePieChart: React.FC<Props> = ({ breakdown }) => {
  if (!breakdown || breakdown.length === 0) {
    return <p>No data available for chart.</p>;
  }

  const totalMaxScore = breakdown.reduce((sum, item) => sum + item.maxScore, 0);

  if (totalMaxScore === 0) {
      return <p>Max score is zero, cannot display chart.</p>;
  }

  let cumulativePercentage = 0;
  const gradientParts = breakdown.map((item, index) => {
    const percentage = (item.maxScore / totalMaxScore) * 100;
    const start = cumulativePercentage;
    const end = cumulativePercentage + percentage;
    cumulativePercentage = end;
    return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
  });

  const pieStyle: React.CSSProperties = {
    background: `conic-gradient(${gradientParts.join(', ')})`,
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div 
        className="w-48 h-48 rounded-full" 
        style={pieStyle} 
        role="img" 
        aria-label="Pie chart showing score distribution by criterion"
      ></div>
      <div className="mt-4 w-full text-left text-sm space-y-1">
        {breakdown.map((item, index) => (
          <div key={index} className="flex items-center">
            <span 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            ></span>
            <span>{item.criterion} ({item.score}/{item.maxScore})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScorePieChart;
