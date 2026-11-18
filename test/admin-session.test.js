const test=require('node:test');
const assert=require('node:assert/strict');
const {createAdminSession}=require('../lib/admin-session');
function fakeRes(){const headers={};return {headers,getHeader:n=>headers[n.toLowerCase()],setHeader:(n,v)=>{headers[n.toLowerCase()]=v;}};}
const cookieOf=res=>[].concat(res.headers['set-cookie']).at(-1);
const tokenOf=res=>decodeURIComponent(cookieOf(res).split(';')[0].split('=').slice(1).join('='));
test('remembered admin sessions last for days, renew while used and end when the password changes',()=>{
 let clock=Date.UTC(2026,0,1);const now=()=>clock;const req={headers:{'x-forwarded-proto':'https'}};
 const session=createAdminSession({secret:'s',user:'admin',password:'pw',sessionHours:12,rememberDays:30,now});
 let res=fakeRes();session.issue(req,res,false);assert.match(cookieOf(res),/Max-Age=43200/);assert.match(cookieOf(res),/HttpOnly/);assert.match(cookieOf(res),/Secure/);
 const short=tokenOf(res);clock+=13*3600e3;assert.equal(session.verify(short),null);
 res=fakeRes();session.issue(req,res,true);assert.match(cookieOf(res),/Max-Age=2592000/);const long=tokenOf(res);
 clock+=10*86400e3;let payload=session.verify(long);assert.ok(payload);res=fakeRes();session.renew(req,res,payload);assert.equal(res.headers['set-cookie'],undefined);
 clock+=10*86400e3;payload=session.verify(long);res=fakeRes();session.renew(req,res,payload);const renewed=tokenOf(res);
 clock+=25*86400e3;assert.equal(session.verify(long),null);assert.ok(session.verify(renewed));
 const changed=createAdminSession({secret:'s',user:'admin',password:'novo',now});assert.equal(changed.verify(renewed),null);
 assert.equal(session.verify(renewed.replace(/.$/,c=>c==='A'?'B':'A')),null);
});
