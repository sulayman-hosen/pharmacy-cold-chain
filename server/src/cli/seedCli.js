import { connectDb } from '../database/connection.js';
import { mongoose } from '../database/models.js';
import { seed } from '../database/seeders.js';

try {
  await connectDb();
  await seed();
  console.log(
    'Demo users and synthetic resources are ready. Existing data was preserved.'
  );
} catch (error) {
  console.error(error.code ?? 'SEED_FAILED');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
