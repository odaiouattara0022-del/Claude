const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.argv[2],{waitUntil:'load'});
 await p.pdf({path:process.argv[3],format:'A4',printBackground:true,preferCSSPageSize:true,outline:true,tagged:true});
 await p.emulateMedia({media:'print'});
 console.log('errs',errs);
 await b.close();
})();
