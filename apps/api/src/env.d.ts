declare module 'bun' {
  interface Env {
    MONGODB_URI: string;
    DATABASE_NAME: string;
  }
}
