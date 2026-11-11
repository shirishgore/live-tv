import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // NOTE: drizzle-kit 0.31's sqlite dialect defaults to the libsql driver;
  // its Config type does not accept driver: 'libsql', so it is omitted.
});
