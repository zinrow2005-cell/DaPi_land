/* 通用畜牧場周界 v6-22: app shell cache + bounded CDN dependency cache; DO NOT cache NLSC/OSM tiles. */
const VERSION='livestock-v623-20261128a';
const SHELL=VERSION+'-shell';
const LIBS=VERSION+'-libraries';
const shellFiles=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const depHosts=new Set(['unpkg.com','cdn.jsdelivr.net']);
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const c=await caches.open(SHELL);
 await Promise.allSettled(shellFiles.map(f=>c.add(f)));
 const libs=await caches.open(LIBS);
 await Promise.allSettled([
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js'
 ].map(url=>libs.add(url)));
 self.skipWaiting();
})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>(k.startsWith('dapi-')||k.startsWith('livestock-'))&&!k.startsWith(VERSION)).map(k=>caches.delete(k)));
 await self.clients.claim();
})())});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 // No tile/lookup caching: prevents hundreds of high resolution map tiles from exhausting storage.
 if(!depHosts.has(url.hostname)&&url.origin!==self.location.origin)return;
 const isLib=depHosts.has(url.hostname);
 if(isLib){event.respondWith((async()=>{
  const c=await caches.open(LIBS);
  const hit=await c.match(req);if(hit)return hit;
  try{const net=await fetch(req);if(net.ok||net.type==='opaque')await c.put(req,net.clone());return net}
  catch(e){return new Response('External map library unavailable offline',{status:503})}
 })());return}
 // Local shell: network-first to surface fresh versions, cache fallback offline.
 event.respondWith((async()=>{
  const c=await caches.open(SHELL);
  try{const net=await fetch(req);if(net.ok)await c.put(req,net.clone());return net}
  catch(e){const fallback=await c.match(req,{ignoreSearch:true});return fallback||new Response('離線中，尚未快取此頁面',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
 })());
});
