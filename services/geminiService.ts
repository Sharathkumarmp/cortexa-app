import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateRubric(assignmentDescription: string): Promise<string> {
  const model = "gemini-2.5-flash";

  const systemInstruction = `You are an expert curriculum designer. Your task is to generate a detailed evaluation rubric based on an assignment description.
- The rubric must be formatted as a numbered list.
- Each item must include: a clear criterion name, the maximum points in parentheses, and a brief, precise description of what is being assessed.
- The total points for all criteria should logically sum to 100.
- Example Format: '1. Clarity of Thesis (20 points): The main argument is clear, concise, and well-defined.'
- Respond ONLY with the numbered list for the rubric. Do not include any other text, explanations, titles, or markdown formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: assignmentDescription,
      config: {
        systemInstruction: systemInstruction,
        seed: Math.floor(Math.random() * 1000), // Use random seed for variety in rubrics
      },
    });

    const generatedText = response.text.trim();
    if (!generatedText) {
        throw new Error("The AI returned an empty rubric. Please try describing the assignment differently.");
    }
    return generatedText;
  } catch (error) {
    console.error("Error generating rubric:", error);
    throw new Error("Failed to generate rubric from the AI. Please try again.");
  }
}

export async function evaluateAssignment(
  assignment: string, 
  rubric: string,
  checkSimilarity: boolean,
  checkAIContent: boolean
): Promise<EvaluationResult> {
  const model = "gemini-2.5-flash";

  let systemInstruction = `You are an expert educator providing concise and unique feedback for each student assignment.
  1.  **Analyze Deeply:** Read the assignment carefully, comparing it against each rubric criterion.
  2.  **Score Accurately:** Assign a precise score for each criterion. The total should reflect the overall quality.
  3.  **Provide Brief, Unique Feedback:** For each criterion, write 1-2 sentences of feedback.
      -   **CRITICAL:** This feedback must be **unique** to this specific assignment. Do not use repetitive or boilerplate text across different evaluations.
      -   Be specific and justify your score with brief examples from the text, but avoid long quotes.
  4.  **Write a Very Brief Summary:** Write a 2-3 sentence summary of the key strengths and most important areas for improvement.
  5.  **Maintain Professional Tone:** Your language should be encouraging and educational.`;

  if (checkSimilarity) {
    systemInstruction += `\n6. **Conduct Similarity Analysis:** Perform a similarity check. Provide a percentage score and a brief summary explaining your findings.`;
  }
  if (checkAIContent) {
    systemInstruction += `\n7. **Detect AI Content:** Analyze the text for AI generation patterns. Provide a likelihood (e.g., "High", "Medium", "Low") and a brief summary of the evidence.`;
  }
  systemInstruction += `\n\n**Response Format:** Respond ONLY with the JSON object specified in the schema. Do not include any other text, explanations, or markdown formatting.`;


  const prompt = `
    Student Assignment:
    ---
    ${assignment}
    ---

    Evaluation Rubric:
    ---
    ${rubric}
    ---
  `;

  const responseSchema: any = {
      type: Type.OBJECT,
      properties: {
        overallScore: { type: Type.NUMBER, description: "The total score for the assignment." },
        maxScore: { type: Type.NUMBER, description: "The maximum possible score based on the rubric." },
        summaryFeedback: { type: Type.STRING, description: "A summary of the overall feedback, highlighting strengths and areas for improvement." },
        detailedBreakdown: {
          type: Type.ARRAY,
          description: "A detailed breakdown of the evaluation for each criterion.",
          items: {
            type: Type.OBJECT,
            properties: {
              criterion: { type: Type.STRING, description: "The name of the rubric criterion." },
              score: { type: Type.NUMBER, description: "The score awarded for this criterion." },
              maxScore: { type: Type.NUMBER, description: "The maximum score for this criterion, as stated in the rubric." },
              feedback: { type: Type.STRING, description: "Specific, actionable, and non-generic feedback for this criterion, with examples from the text." },
            },
            required: ["criterion", "score", "maxScore", "feedback"],
          },
        },
      },
      required: ["overallScore", "maxScore", "summaryFeedback", "detailedBreakdown"],
  };

  if (checkSimilarity) {
    responseSchema.properties.similarityCheck = {
      type: Type.OBJECT,
      description: "The result of the plagiarism/similarity check.",
      properties: {
        score: { type: Type.NUMBER, description: "A similarity score from 0 to 100, where higher means more similar." },
        summary: { type: Type.STRING, description: "A summary of the similarity findings and potentially similar sources." }
      },
      required: ["score", "summary"]
    };
  }

  if (checkAIContent) {
    responseSchema.properties.aiContentCheck = {
      type: Type.OBJECT,
      description: "The result of the AI content detection analysis.",
      properties: {
        likelihood: { type: Type.STRING, description: "The likelihood of AI generation (e.g., 'High', 'Medium', 'Low')." },
        summary: { type: Type.STRING, description: "A summary of the AI content detection findings." }
      },
      required: ["likelihood", "summary"]
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    // Sometimes the API wraps the JSON in markdown backticks. This removes them.
    const cleanedJsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleanedJsonText) as EvaluationResult;

  } catch (error) {
    console.error("Error evaluating assignment:", error);
    throw new Error("Failed to get a valid evaluation from the AI. The model may have returned an unexpected format. Please try again.");
  }
}