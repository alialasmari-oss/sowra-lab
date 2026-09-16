/* صورة من بلدي — core/geo.js
   الإحداثيات والمسافات وقراءة EXIF */

/* ====== التحقق من صحة الإحداثيات ====== */
export function validPos(p){
  if(!p) return null;
  const la = Number(p.lat), ln = Number(p.lng);
  if(!isFinite(la) || !isFinite(ln)) return null;
  if(Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if(la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/* حدود المملكة تقريباً — لكشف صور المسافر الخاطئة */
export function insideSA(lat, lng){
  return lat>=16 && lat<=32.2 && lng>=34.5 && lng<=55.7;
}

/* ====== المسافة بالكيلومترات ====== */
export function haversine(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ====== الموقع الحالي ====== */
export function liveLocation(){
  return new Promise(resolve => {
    if(!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat:p.coords.latitude, lng:p.coords.longitude, acc:Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
    );
  });
}

/* ====== قارئ EXIF للموقع (الأساسي) ====== */
export function readExifGPS(file){
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => {
      try{
        const v = new DataView(e.target.result);
        if(v.getUint16(0) !== 0xFFD8) return resolve(null);
        let off = 2;
        while(off < v.byteLength - 4){
          if(v.getUint16(off) === 0xFFE1){
            const tiff = off + 10;
            const little = v.getUint16(tiff) === 0x4949;
            const g16 = o => v.getUint16(o, little), g32 = o => v.getUint32(o, little);
            const ifd0 = tiff + g32(tiff + 4);
            let gpsIFD = 0, n = g16(ifd0);
            for(let i=0;i<n;i++){
              const en = ifd0 + 2 + i*12;
              if(g16(en) === 0x8825){ gpsIFD = tiff + g32(en+8); break; }
            }
            if(!gpsIFD) return resolve(null);
            let latRef="N", lngRef="E", lat=null, lng=null;
            const rat = o => { const p = tiff + g32(o+8); return [g32(p)/g32(p+4), g32(p+8)/g32(p+12), g32(p+16)/g32(p+20)]; };
            const gn = g16(gpsIFD);
            for(let i=0;i<gn;i++){
              const en = gpsIFD + 2 + i*12, tag = g16(en);
              if(tag===1) latRef = String.fromCharCode(v.getUint8(en+8));
              if(tag===3) lngRef = String.fromCharCode(v.getUint8(en+8));
              if(tag===2) lat = rat(en);
              if(tag===4) lng = rat(en);
            }
            if(!lat || !lng) return resolve(null);
            const toD = (a, ref) => (a[0] + a[1]/60 + a[2]/3600) * (ref==="S"||ref==="W" ? -1 : 1);
            return resolve(validPos({ lat: toD(lat, latRef), lng: toD(lng, lngRef) }));
          }
          off += 2 + v.getUint16(off+2);
        }
        resolve(null);
      }catch(err){ resolve(null); }
    };
    r.readAsArrayBuffer(file.slice(0, 256*1024));
  });
}

/* ====== قارئ احتياطي — بنية EXIF غير معيارية ====== */
export async function readExifGPS2(file){
  try{
    const buf = await file.slice(0, 512*1024).arrayBuffer();
    const dv = new DataView(buf);
    if(dv.getUint16(0) !== 0xFFD8) return null;

    let off = 2, tiff = 0;
    while(off < dv.byteLength - 4){
      const marker = dv.getUint16(off);
      if(marker === 0xFFE1 && dv.getUint32(off+4) === 0x45786966){ tiff = off+10; break; }
      if((marker & 0xFF00) !== 0xFF00) break;
      const len = dv.getUint16(off+2);
      if(!len) break;
      off += 2 + len;
    }
    if(!tiff) return null;

    const le = dv.getUint16(tiff) === 0x4949;
    const u16 = p => dv.getUint16(p, le);
    const u32 = p => dv.getUint32(p, le);

    const ifd0 = tiff + u32(tiff+4);
    if(ifd0 >= dv.byteLength) return null;
    const n0 = u16(ifd0);
    let gpsOff = 0;
    for(let i=0;i<n0;i++){
      const e = ifd0 + 2 + i*12;
      if(e + 12 > dv.byteLength) break;
      if(u16(e) === 0x8825){ gpsOff = tiff + u32(e+8); break; }
    }
    if(!gpsOff || gpsOff >= dv.byteLength) return null;

    const rat = p => { const a = u32(p), b = u32(p+4); return b ? a/b : 0; };
    const g = {};
    const ng = u16(gpsOff);
    for(let i=0;i<ng;i++){
      const e = gpsOff + 2 + i*12;
      if(e + 12 > dv.byteLength) break;
      const tag = u16(e), type = u16(e+2), cnt = u32(e+4);
      if(tag===1 || tag===3){
        g[tag] = String.fromCharCode(dv.getUint8(e+8));
      }else if((tag===2 || tag===4) && type===5 && cnt===3){
        const vo = tiff + u32(e+8);
        if(vo + 24 <= dv.byteLength) g[tag] = [rat(vo), rat(vo+8), rat(vo+16)];
      }
    }
    if(!g[2] || !g[4]) return null;

    const toDeg = a => a[0] + a[1]/60 + a[2]/3600;
    let lat = toDeg(g[2]), lng = toDeg(g[4]);
    if(g[1] === 'S') lat = -lat;
    if(g[3] === 'W') lng = -lng;
    return validPos({ lat, lng });
  }catch(e){ return null; }
}

/* يحاول القارئين معاً */
export async function readGPS(file){
  return (await readExifGPS(file)) || (await readExifGPS2(file));
}

/* ====== استنتاج اسم المكان من الإحداثيات ====== */
export async function reverseGeo(lat, lng){
  try{
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat='+lat+'&lon='+lng,
      { headers:{ 'Accept-Language':'ar' } });
    if(!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    return {
      region:  a.state || a.region || '',
      city:    a.city || a.town || a.municipality || a.county || '',
      village: a.village || a.suburb || a.neighbourhood || a.hamlet || '',
      country: a.country || ''
    };
  }catch(e){ return null; }
}

/* البحث عن مكان بالاسم */
export async function searchPlace(q){
  try{
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sa&q='+encodeURIComponent(q),
      { headers:{ 'Accept-Language':'ar' } });
    const j = await r.json();
    if(j && j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
    return null;
  }catch(e){ return null; }
}
