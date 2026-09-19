import {User,Session,transaction} from './db.js';
import {config} from './config.js';
import {AppError,assert,sha256,secret,hashPassword,checkPassword,sameSecret} from './core.js';
import {appendAudit,audit} from './audit.js';
const dummy=hashPassword(secret());
export const publicUser=u=>({id:u._id,name:u.name,username:u.username,role:u.role,floors:u.floors});
export async function login(username,password) {
  const u=await User.findOne({username,active:true}).lean();
  const valid=checkPassword(password,u?.passwordHash??dummy);
  if(!u||!valid) {await audit({action:'LOGIN_FAILED',outcome:'4'});throw new AppError(401,'LOGIN_FAILED','Username or password is incorrect.');}
  const token=secret(),csrf=secret(),expiresAt=new Date(Date.now()+config.SESSION_HOURS*3600000);
  await transaction(async s=>{await Session.create([{_id:sha256(token),userId:u._id,csrf,expiresAt}],{session:s});await appendAudit(s,{actor:u._id,action:'LOGIN_SUCCEEDED'});});
  return {user:publicUser(u),token,csrf,expiresAt};
}
export async function authenticate(req,res,next) {
  const token=req.cookies?.coldline;
  if(!token||!/^[a-f0-9]{64}$/.test(token)) throw new AppError(401,'UNAUTHENTICATED','Please sign in.');
  const session=await Session.findOne({_id:sha256(token),expiresAt:{$gt:new Date()}}).lean();
  if(!session) throw new AppError(401,'SESSION_EXPIRED','Your session expired. Please sign in again.');
  const user=await User.findOne({_id:session.userId,active:true}).lean();
  if(!user) throw new AppError(401,'UNAUTHENTICATED','Please sign in.');
  req.user=user;req.session=session;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) assert(sameSecret(req.get('X-CSRF-Token'),session.csrf),'CSRF_INVALID','Session verification failed. Reload and try again.',403);
  next();
}
export const roles=(...allowed)=>(req,res,next)=>{assert(allowed.includes(req.user.role),'ACCESS_DENIED','Your role cannot perform this action.',403);next();};
export const cookieOptions={httpOnly:true,sameSite:'strict',secure:config.NODE_ENV==='production',path:'/api'};
