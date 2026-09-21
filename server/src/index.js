import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from './config.js';
import {connectDb,mongoose} from './db.js';
import {createApp} from './app.js';
import {checkFhirVersion} from './fhir.js';
import {startWorker} from './worker.js';
export async function start({afterConnect,cleanup}={}) {
  let activeCleanup = cleanup;
  try {
    await connectDb();
  } catch (err) {
    const isLocal = config.MONGO_URI.includes('127.0.0.1') || config.MONGO_URI.includes('localhost');
    if (config.NODE_ENV === 'development' && !afterConnect && isLocal) {
      console.log('\n[Coldline] Local MongoDB (27017) unavailable. Starting in-memory MongoDB replica set...');
      const {temporaryMongo} = await import('../scripts/temporary-mongo.js');
      const temp = await temporaryMongo();
      config.MONGO_URI = temp.mongo.getUri('cold_chain_dev');
      activeCleanup = temp.stop;
      await connectDb();
      const {seed} = await import('./seed.js');
      await seed();
      console.log('[Coldline] In-memory MongoDB active and seeded with demo accounts.\n');
    } else {
      throw err;
    }
  }

  await checkFhirVersion();
  if (afterConnect) await afterConnect();
  const server=createApp().listen(config.PORT,'127.0.0.1',()=>console.log(`Coldline ready at http://localhost:${config.PORT} (${config.INTEGRATION_MODE} mode)`));
  const stopWorker=startWorker();let closing=false;
  const stop=async()=>{if(closing)return;closing=true;stopWorker();await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();if(activeCleanup)await activeCleanup();process.exit(0);};
  process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
  return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))start().catch(error=>{
  console.error('\n❌ STARTUP FAILED:', error.message || error);
  process.exit(1);
});
