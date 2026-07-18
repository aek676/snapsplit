declare module 'bun' {
  interface Env {
    MONGODB_URI: string;
    DATABASE_NAME: string;
    GOOGLE_GENERATIVE_AI_API_KEY: string;
    GEMINI_MODEL?: string;
    RECEIPT_EXTRACTION_MAX_ATTEMPTS?: string;
    GCS_BUCKET: string;
    GCS_EMULATOR_HOST?: string;
  }
}
