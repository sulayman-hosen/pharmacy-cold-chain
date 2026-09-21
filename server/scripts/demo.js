import {temporaryMongo} from './temporary-mongo.js';
// A real temporary MongoDB replica set; no fake repository layer.
console.log('Starting temporary MongoDB. The first run downloads a MongoDB binary.');
const {mongo,stop}=await temporaryMongo();
process.env.MONGO_URI=mongo.getUri('cold_chain_demo');
process.env.INTEGRATION_MODE='demo';process.env.NODE_ENV='development';
try {
  const {start}=await import('../src/index.js');
  const {seed}=await import('../src/seed.js');
  await start({afterConnect:seed,cleanup:stop});
} catch(error) {await stop();console.error(error.code??'DEMO_START_FAILED');process.exit(1);}
