import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {connectDb,mongoose,transaction,Audit,AuditHead} from './db.js';
import {audit,verifyRecords} from './audit.js';
import {config} from './config.js';
import {sign,sha256,assert} from './core.js';
const path=resolve(process.argv[3]??process.argv[2]??`.local/audit-export-${Date.now()}.json`);
try {
  if(process.argv[2]==='--verify') {
    assert(process.argv[3],'ARCHIVE_PATH','Specify the exported JSON file.');
    const data=JSON.parse(readFileSync(path,'utf8'));
    assert(sign(config.AUDIT_HMAC_KEY,data.checkpoint)===data.signature,'ARCHIVE_SIGNATURE','The archive checkpoint signature does not match.');
    const result=verifyRecords(data.records,data.checkpoint,config.AUDIT_HMAC_KEY);
    assert(result.valid,'ARCHIVE_TAMPERED','The archive chain failed verification.');
    console.log(`Verified ${result.checked} archived records.`);
  } else {
    await connectDb();await audit({action:'AUDIT_EXPORTED'});
    const archive=await transaction(async session=>{
      const records=await Audit.find().sort({seq:1}).session(session).lean();const head=await AuditHead.findById('main').session(session).lean();
      assert(verifyRecords(records,head,config.AUDIT_HMAC_KEY).valid,'AUDIT_TAMPERED','Refusing to export an invalid audit chain.');
      const checkpoint={seq:head.seq,hash:head.hash};
      return {format:'coldline-audit-v1',exportedAt:new Date().toISOString(),keyId:sha256(config.AUDIT_HMAC_KEY).slice(0,16),checkpoint,signature:sign(config.AUDIT_HMAC_KEY,checkpoint),records};
    });
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(archive,null,2),{flag:'wx',mode:0o600});
    console.log(`Exported ${archive.records.length} records to ${path}. Retain the checkpoint in a separate immutable archive.`);
  }
} catch(e) {console.error(e.code??'AUDIT_EXPORT_FAILED');process.exitCode=1;}
finally {await mongoose.disconnect();}
