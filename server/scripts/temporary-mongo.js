import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
export async function temporaryMongo() {
  const root=fileURLToPath(new URL('../../.local/',import.meta.url));
  await mkdir(root,{recursive:true});
  const dbPath=await mkdtemp(join(root,'mongo-'));
  const args=process.platform==='win32'?[]:['--nounixsocket'];
  const mongo=await MongoMemoryReplSet.create({instanceOpts:[{dbPath,args:[...args,'--setParameter','diagnosticDataCollectionEnabled=false']}],replSet:{count:1,storageEngine:'wiredTiger'}});
  return {mongo,stop:async()=>{await mongo.stop();await rm(dbPath,{recursive:true,force:true});}};
}
