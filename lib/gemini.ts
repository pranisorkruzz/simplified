const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export async function sendToGemini(
  message: string,
  fileBase64?: string,
  mimeType?: string
): Promise<string> {
  try {
    const parts: any[] = [{ text: message }];

    if (fileBase64 && mimeType) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: fileBase64,
        },
      });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response';
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

export function extractTasksFromResponse(text: string): string[] {
  const tasks: string[] = [];

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.match(/^\d+[\.\)]\s/) ||
      trimmed.match(/^[-*]\s/) ||
      trimmed.startsWith('• ')
    ) {
      const taskText = trimmed
        .replace(/^\d+[\.\)]\s/, '')
        .replace(/^[-*•]\s/, '')
        .trim();

      if (taskText.length > 0) {
        tasks.push(taskText);
      }
    }
  }

  return tasks.length > 0 ? tasks : [text];
}
