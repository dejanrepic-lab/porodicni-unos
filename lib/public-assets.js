const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

// HTML is not cached; its local assets get new URLs whenever their contents change.
// Cache file hashes for the life of this process (assets ship with the application).
function createAssetVersioner(directory){
 const versions=new Map();
 return html=>html.replace(/\b(src|href)="\/([a-zA-Z0-9_-]+\.(?:css|js))(?:\?[^"]*)?"/g,(tag,attribute,file)=>{
  if(!versions.has(file)){
   let content;
   try{content=fs.readFileSync(path.join(directory,file));}
   catch(error){if(error.code==='ENOENT')return tag;throw error;}
   versions.set(file,crypto.createHash('sha256').update(content).digest('hex').slice(0,16));
  }
  return attribute+'="/'+file+'?v='+versions.get(file)+'"';
 });
}
const versionPublicAssets=createAssetVersioner(path.join(__dirname,'../public'));
module.exports={createAssetVersioner,versionPublicAssets};
