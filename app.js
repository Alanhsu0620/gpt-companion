/* GPT Companion V1.1 - GPS diagnostics and resilient map initialization. */
const $ = id => document.getElementById(id);
const mapAvailable = !!(window.L && $('map'));
let map = null;
if (mapAvailable) {
  try {
    map = L.map('map', {zoomControl:true}).setView([25.033,121.5654], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19, attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);
  } catch (err) {
    console.warn('Map initialization failed; GPS remains available.', err);
    map = null;
  }
}
let userMarker = null, destinationMarker = null, routeLine = null, watchId = null, wakeLock = null;
let currentPosition = null, routeData = null, maneuvers = [], nextManeuver = 0, active = false, lastSpoken = {};
let voiceList = [];

function setStatus(text){ $('searchStatus').textContent = text; }
function setGpsDiagnostic(text){ const el=$('gpsDiagnostic'); if(el) el.textContent=text; }
function gpsErrorMessage(e){
  if (e && e.code === 1) return '定位權限被拒絕。請到 iPhone「設定 → 隱私權與安全性 → 定位服務」允許 Safari 網站使用位置。';
  if (e && e.code === 2) return '裝置目前無法取得位置。請確認定位服務已開啟，並移至訊號較好的位置。';
  if (e && e.code === 3) return '定位逾時。請稍候再試，並確認精確位置已開啟。';
  return e?.message || '未知定位錯誤。';
}
function getPosition(){
  return new Promise((resolve,reject)=>{
    if (!window.isSecureContext) return reject(new Error('目前網站不是安全 HTTPS 連線。請使用 https:// 開頭的 GitHub Pages 網址。'));
    if (!navigator.geolocation) return reject(new Error('此瀏覽器沒有提供 Geolocation API。請使用最新版 iPhone Safari。'));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>reject(new Error(gpsErrorMessage(e))),
      {enableHighAccuracy:true,timeout:20000,maximumAge:0}
    );
  });
}
async function testGps(){
  const btn=$('locateBtn'); if(btn){btn.disabled=true;btn.textContent='正在取得 GPS…';}
  setGpsDiagnostic('正在向 iPhone 要求定位權限…');
  if (!window.isSecureContext) {
    setGpsDiagnostic('失敗：網站不是 HTTPS 安全連線。請使用 https:// 開頭的網址。');
    if(btn){btn.disabled=false;btn.textContent='📍 重新測試 GPS';} return;
  }
  try {
    const p=await getPosition();
    currentPosition=p;
    const msg=`定位成功｜緯度 ${p.lat.toFixed(6)}｜經度 ${p.lon.toFixed(6)}｜精度約 ${Math.round(p.accuracy)} 公尺`;
    setGpsDiagnostic(msg);
    $('gpsChip').textContent=`GPS 精度約 ${Math.round(p.accuracy)} 公尺`;
    if (map && window.L) {
      if(userMarker) userMarker.setLatLng([p.lat,p.lon]);
      else userMarker=L.circleMarker([p.lat,p.lon],{radius:8,color:'#fff',weight:3,fillColor:'#168d78',fillOpacity:1}).addTo(map);
      map.setView([p.lat,p.lon],16);
    }
    setStatus('GPS 定位成功，可以搜尋目的地。');
  } catch(e) {
    setGpsDiagnostic('定位失敗：'+e.message);
    setStatus('GPS 尚未成功：'+e.message);
  } finally {
    if(btn){btn.disabled=false;btn.textContent='📍 重新測試 GPS';}
  }
}
function haversine(a,b){ const R=6371000, rad=x=>x*Math.PI/180; const dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]); const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(x)); }
function fmtDistance(m){ return m>=1000 ? (m/1000).toFixed(m>=10000?0:1)+' 公里' : Math.max(0,Math.round(m/10)*10)+' 公尺'; }
function fmtDuration(sec){ const min=Math.round(sec/60); return min>=60?`${Math.floor(min/60)} 小時 ${min%60} 分鐘`:`${min} 分鐘`; }
function maneuverText(step){ const m=step.maneuver||{}, type=m.type||'continue', mod=m.modifier||''; const mapText={turn:{left:'左轉',right:'右轉',slight_left:'稍微左轉',slight_right:'稍微右轉',sharp_left:'大幅左轉',sharp_right:'大幅右轉',uturn:'迴轉'},merge:'匯入車道',fork:'選擇岔路',on_ramp:'進入匝道',off_ramp:'駛出匝道',roundabout:'進入圓環',rotary:'進入圓環',arrive:'抵達目的地',depart:'出發',continue:'直行'}; if(type==='turn') return mapText.turn[mod]||'轉彎'; if(type==='roundabout'||type==='rotary') return '進入圓環'; return mapText[type]||'繼續前行';}
function phraseFor(step, lead=''){ const road=step.name?`，沿著${step.name}`:''; const action=maneuverText(step); if(action==='抵達目的地') return '已經抵達目的地囉。'; return `${lead}${action}${road}，注意安全喔。`; }
function pickVoice(){ const selected=$('voiceSelect').value; if(selected!=='auto') return voiceList.find(v=>v.name===selected)||null; return voiceList.find(v=>v.lang?.toLowerCase()==='zh-tw') || voiceList.find(v=>v.lang?.toLowerCase().startsWith('zh')) || null; }
function refreshVoices(){ if(!('speechSynthesis' in window))return; voiceList=speechSynthesis.getVoices(); const select=$('voiceSelect'), old=select.value; select.innerHTML='<option value="auto">自動選擇台灣中文女聲</option>'; voiceList.filter(v=>v.lang?.toLowerCase().startsWith('zh')).forEach(v=>{const o=document.createElement('option');o.value=v.name;o.textContent=`${v.name}（${v.lang}）`;select.appendChild(o);}); if([...select.options].some(o=>o.value===old))select.value=old; }
function speak(text){ if(!('speechSynthesis' in window)){setStatus('這個瀏覽器不支援語音合成。');return;} speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); const v=pickVoice(); if(v){u.voice=v;u.lang=v.lang;}else u.lang='zh-TW'; u.rate=Number($('speedSlider').value);u.pitch=1.12;u.volume=Number($('volumeSlider').value);speechSynthesis.speak(u); $('voicePreview').textContent=`「${text}」`; }
function speakThreshold(step,index,distance){ const thresholds=[500,150,40]; for(const t of thresholds){const key=`${index}-${t}`;if(distance<=t && !lastSpoken[key]){lastSpoken[key]=true;const lead=t===500?'前方約 500 公尺，':t===150?'前方約 150 公尺，':'準備';speak(phraseFor(step,lead));break;}} }
async function geocode(query){ const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`; const r=await fetch(url,{headers:{'Accept':'application/json'}}); if(!r.ok)throw new Error('地點搜尋服務暫時無法使用'); const data=await r.json(); if(!data.length)throw new Error('找不到這個地點，請試著輸入更完整的地址'); return {lat:Number(data[0].lat),lon:Number(data[0].lon),name:data[0].display_name}; }
async function planRoute(dest){
  const start=currentPosition||await getPosition(); currentPosition=start;
  const url=`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson&steps=true`;
  const r=await fetch(url); if(!r.ok)throw new Error('路線服務暫時無法使用'); const data=await r.json(); if(data.code!=='Ok'||!data.routes?.length)throw new Error('目前無法規劃這段路線');
  const route=data.routes[0]; routeData={route,dest}; maneuvers=[];
  route.legs.forEach(leg=>leg.steps.forEach(step=>{if(step.maneuver?.location) maneuvers.push({step,coord:[step.maneuver.location[1],step.maneuver.location[0]],distanceFromStart:step.distance});}));
  nextManeuver=Math.min(1,Math.max(0,maneuvers.length-1));lastSpoken={};
  if(map && window.L){
    if(routeLine)map.removeLayer(routeLine);
    routeLine=L.geoJSON(route.geometry,{style:{color:'#168d78',weight:6,opacity:.9}}).addTo(map);
    if(destinationMarker)map.removeLayer(destinationMarker);
    destinationMarker=L.marker([dest.lat,dest.lon]).addTo(map).bindPopup('目的地');
    if(userMarker)map.removeLayer(userMarker);
    userMarker=L.circleMarker([start.lat,start.lon],{radius:8,color:'#fff',weight:3,fillColor:'#168d78',fillOpacity:1}).addTo(map);
    map.fitBounds(routeLine.getBounds(),{padding:[30,30]});
  }
  $('remainingDistance').textContent=fmtDistance(route.distance);$('remainingTime').textContent=fmtDuration(route.duration);$('stepCount').textContent=String(maneuvers.length);$('routeState').textContent='路線已規劃';$('startBtn').disabled=false;$('googleMapsBtn').disabled=false;updateNextTurn(start);setStatus(`已找到目的地：${dest.name}`);
}
function updateNextTurn(pos){ if(!routeData||!maneuvers.length)return; while(nextManeuver<maneuvers.length-1 && haversine([pos.lat,pos.lon],maneuvers[nextManeuver].coord)<32) nextManeuver++; const m=maneuvers[nextManeuver]; const d=haversine([pos.lat,pos.lon],m.coord); $('turnTitle').textContent=maneuverText(m.step);$('turnDistance').textContent=d<35?'即將通過路口':`${fmtDistance(d)} 後${maneuverText(m.step)}`;$('turnIcon').textContent=maneuverText(m.step).includes('左')?'↰':maneuverText(m.step).includes('右')?'↱':'↑'; $('stepCount').textContent=String(Math.max(0,maneuvers.length-nextManeuver-1)); }
function onPosition(pos){ currentPosition={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};$('gpsChip').textContent=`GPS 精度約 ${Math.round(pos.coords.accuracy)} 公尺`; if(map && window.L){if(userMarker)userMarker.setLatLng([currentPosition.lat,currentPosition.lon]);else userMarker=L.circleMarker([currentPosition.lat,currentPosition.lon],{radius:8,color:'#fff',weight:3,fillColor:'#168d78',fillOpacity:1}).addTo(map);} if(!routeData)return; const m=maneuvers[nextManeuver]; if(m){const d=haversine([currentPosition.lat,currentPosition.lon],m.coord);speakThreshold(m.step,nextManeuver,d);updateNextTurn(currentPosition);const remain=haversine([currentPosition.lat,currentPosition.lon],[routeData.dest.lat,routeData.dest.lon]);$('remainingDistance').textContent=fmtDistance(remain);if(remain<35&&active){speak('我們已經抵達目的地囉，辛苦了。');stopNavigation(true);}} }
async function startNavigation(){ if(!routeData)return; try{ const p=await getPosition();onPosition({coords:{latitude:p.lat,longitude:p.lon,accuracy:p.accuracy}}); active=true; $('startBtn').disabled=true;$('stopBtn').disabled=false;$('routeState').textContent='伴駕中'; if($('announceStart').checked)speak('出發囉，我會陪你注意接下來的路況，開車請專心看路。'); if(navigator.geolocation)watchId=navigator.geolocation.watchPosition(onPosition,e=>setStatus('GPS 更新中斷：'+gpsErrorMessage(e)),{enableHighAccuracy:true,maximumAge:3000,timeout:15000}); if($('keepAwake').checked&&'wakeLock'in navigator){try{wakeLock=await navigator.wakeLock.request('screen');}catch(e){console.info('Wake Lock unavailable',e);}} }catch(e){setStatus(e.message);setGpsDiagnostic('定位失敗：'+e.message);} }
function stopNavigation(arrived=false){active=false;if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}if(wakeLock){wakeLock.release();wakeLock=null;}if('speechSynthesis'in window)speechSynthesis.cancel();$('startBtn').disabled=!routeData;$('stopBtn').disabled=true;$('routeState').textContent=arrived?'已抵達':'已暫停';}
$('locateBtn').addEventListener('click',testGps);
$('searchForm').addEventListener('submit',async e=>{e.preventDefault();const q=$('destinationInput').value.trim();if(!q)return;setStatus('正在搜尋目的地並規劃路線…');$('startBtn').disabled=true;try{const [dest,pos]=await Promise.all([geocode(q),getPosition()]);currentPosition=pos;setGpsDiagnostic(`定位成功｜緯度 ${pos.lat.toFixed(6)}｜經度 ${pos.lon.toFixed(6)}｜精度約 ${Math.round(pos.accuracy)} 公尺`);await planRoute(dest);}catch(err){setStatus(err.message);setGpsDiagnostic('定位／路線錯誤：'+err.message);}});
$('startBtn').addEventListener('click',startNavigation);$('stopBtn').addEventListener('click',()=>stopNavigation());$('googleMapsBtn').addEventListener('click',()=>{if(!routeData)return;const {lat,lon}=routeData.dest;window.location.href=`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;});
$('testVoiceBtn').addEventListener('click',()=>speak('嗨，準備好了嗎？接下來就讓我陪你一起出發，路上慢慢開，注意安全喔.'));
$('volumeSlider').addEventListener('input',e=>$('volumeValue').textContent=Math.round(Number(e.target.value)*100)+'%');$('speedSlider').addEventListener('input',e=>$('speedValue').textContent=Number(e.target.value).toFixed(2)+'×');$('settingsBtn').addEventListener('click',()=>$('settingsDialog').showModal());
if('speechSynthesis'in window){refreshVoices();speechSynthesis.onvoiceschanged=refreshVoices;}
if('serviceWorker'in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(console.warn);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && map) setTimeout(()=>map.invalidateSize(),150);});
window.addEventListener('pagehide',()=>{if(watchId!==null)navigator.geolocation.clearWatch(watchId);});
