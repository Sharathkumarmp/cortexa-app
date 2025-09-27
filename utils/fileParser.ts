interface StudentInfo {
  name: string;
  rollNo: string;
}

/**
 * Parses a filename to extract student name and roll number.
 * Assumes the format: "Roll No_Name_... .pdf"
 * @param fileName The full name of the file.
 * @returns An object containing the student's name and roll number.
 */
export function parseStudentInfo(fileName: string): StudentInfo {
  // Remove the file extension (.pdf)
  const baseName = fileName.replace(/\.pdf$/i, '');
  const parts = baseName.split('_');

  if (parts.length >= 2) {
    const rollNo = parts[0].trim();
    const name = parts[1].trim();
    return { name, rollNo };
  }
  
  if (parts.length === 1) {
    // If there's only one part, it's ambiguous. Treat it as the name.
    return { name: parts[0].trim(), rollNo: 'N/A' };
  }

  // Fallback for unexpected formats
  return { name: baseName, rollNo: 'N/A' };
}