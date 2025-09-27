// This tells TypeScript that the Tesseract library is available on the global window object
declare const Tesseract: any;

/**
 * Extracts text from an image file using Tesseract.js OCR.
 * @param file The image file (JPG, PNG) to process.
 * @param onProgress A callback function to report the progress of the OCR operation.
 * @returns A promise that resolves with the extracted text as a string.
 */
export async function extractTextFromImage(
    file: File, 
    onProgress: (progress: any) => void
): Promise<string> {
    try {
        const worker = await Tesseract.createWorker({
            logger: onProgress, // The logger function will act as our progress reporter
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        return text;
    } catch (error) {
        console.error("Error during OCR process:", error);
        // Attempt to clean up the worker on failure if it exists
        // Note: This part is speculative as the worker might not be assigned on error
        try {
            // @ts-ignore - worker might be defined even if createWorker fails at a later stage
            if (worker) await worker.terminate();
        } catch (cleanupError) {
            console.error("Failed to terminate OCR worker after an error:", cleanupError);
        }
        throw new Error("Failed to recognize text from the image. The image might be unclear, in an unsupported format, or a network error occurred.");
    }
}