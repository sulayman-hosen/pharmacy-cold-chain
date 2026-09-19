import {connectDb,mongoose} from './db.js';
import {seed} from './seed.js';
try {await connectDb();await seed();console.log('Demo users and synthetic resources are ready. Existing data was preserved.');}
catch(error){console.error(error.code??'SEED_FAILED');process.exitCode=1;}
finally{await mongoose.disconnect();}
