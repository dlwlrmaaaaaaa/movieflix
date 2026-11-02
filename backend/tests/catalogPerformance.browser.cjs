const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'togetherflix-ui-tools/node_modules/playwright'));
const fs = require('node:fs'); const path = require('node:path'); const zlib = require('node:zlib');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true}); const runs=[];
 for(let i=0;i<3;i++){
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const session = await(await fetch('http://localhost:4109/__test/session/host')).json();
  await context.addInitScript(({user,accessToken})=>{localStorage.setItem('@togetherflix_access_token',accessToken);localStorage.setItem('@togetherflix_user_profile',JSON.stringify(user));},session);
  const page=await context.newPage(); const urls=[]; let images=0;
  await page.route('https://image.tmdb.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#303038"/></svg>'}));
  page.on('request',request=>{if(request.url().includes('/api/'))urls.push(request.url().replace('http://localhost:4109',''));if(request.url().includes('image.tmdb.org'))images++;});
  const started=performance.now();await page.goto('http://localhost:4109/home',{waitUntil:'domcontentloaded'});await page.getByText('Authorized test movie',{exact:true}).first().waitFor();const first=performance.now()-started;
  await page.waitForTimeout(800);const initialCount=urls.length;const initialImages=images;
  await page.getByText('Authorized test movie',{exact:true}).first().click();await page.waitForURL(/movie\/550$/);await page.getByText('Watch Now',{exact:true}).filter({visible:true}).waitFor();await page.waitForTimeout(200);const beforeReturn=urls.length;
  await page.goBack();await page.getByText('Authorized test movie',{exact:true}).first().waitFor();await page.waitForTimeout(500);const returnRequests=urls.length-beforeReturn;
  const search=page.getByPlaceholder('Search movies');const searchStart=performance.now();await search.fill('fixture');await page.waitForResponse(response=>response.url().includes('/search?q=fixture'));const searchMs=performance.now()-searchStart;
  const scroll=await page.evaluate(async()=>{const deltas=[];let last=performance.now();for(let step=0;step<45;step++){await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();deltas.push(now-last);last=now;for(const node of document.querySelectorAll('div')){if(node.scrollHeight>node.clientHeight+200&&getComputedStyle(node).overflowY==='auto')node.scrollTop+=30;}}return {frames:deltas.length,over32ms:deltas.filter(value=>value>32).length,p95ms:deltas.sort((a,b)=>a-b)[Math.floor(deltas.length*.95)]};});
  runs.push({firstContentMs:Math.round(first),initialApiRequests:initialCount,initialImageRequests:initialImages,returnToHomeApiRequests:returnRequests,searchDebounceResponseMs:Math.round(searchMs),scroll,apiRequests:urls});await context.close();
 }
 await browser.close();const directory=path.resolve('mobile/dist/_expo/static/js/web');const bundles=fs.readdirSync(directory).filter(file=>file.endsWith('.js'));const sizes=bundles.map(file=>{const data=fs.readFileSync(path.join(directory,file));return {file,bytes:data.length,gzipBytes:zlib.gzipSync(data).length};});
 const report={environment:'Edge headless, 1440x1000, local isolated API fixture with 24 movies per category; TMDB images replaced by fixed SVG responses; not live TMDB/CDN timings',runs,bundles:sizes};fs.mkdirSync('reports/annahflix',{recursive:true});const label=process.argv[2]||'before';fs.writeFileSync(`reports/annahflix/performance-${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({label,runs:runs.map(({apiRequests,...run})=>run),bundles:sizes}));
})().catch(error=>{console.error(error);process.exitCode=1;});
