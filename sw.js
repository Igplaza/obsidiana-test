/* Obsidiana iPhone beta: caché de interfaz, sin interceptar Supabase ni OAuth externo. */
const CACHE = "obsidiana-ios-beta-20261108-progreso-objetivos-pdf1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./style.css", "./app.js", "./mobile-ui.js", "./progression.js", "./pdf-export.js", "./stats.js", "./sharing.js", "./auth-bundle.js", "./connected.js", "./linking.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('obsidiana-ios-beta-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request; if(req.method!=='GET')return;
  const url=new URL(req.url); if(url.origin!==location.origin)return;
  if(url.searchParams.has('code') || url.searchParams.has('access_token') || url.searchParams.has('error') || url.searchParams.has('state'))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok && response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return (await cache.match(req)) || (req.mode==='navigate' ? await cache.match('./index.html') : Response.error());
  }));
});
