// Muat file .env untuk pengembangan lokal (diabaikan jika file tidak ada atau Node lama)
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch {  }