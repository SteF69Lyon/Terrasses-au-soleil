import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const geminiLiveToken = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        "Connexion requise pour accéder à l'assistant vocal."
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    return { apiKey };
  }
);
