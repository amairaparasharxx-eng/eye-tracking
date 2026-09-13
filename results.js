const data=JSON.parse(localStorage.getItem("eyeObservationSession")||"null");
if(!data){document.getElementById("summary").textContent="No session data was found. Please run a session first.";throw new Error("No session");}

function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
const tests=data.tests||[];

function maxTest(id){return tests.find(x=>x.id===id)}
const up=maxTest("upgaze"), horiz=maxTest("horizontal"), vert=maxTest("vertical"), close=maxTest("closure"), rep=maxTest("repeat");

function scale(value, low, high){
  if(value<=low)return 0;if(value>=high)return 10;
  return value<((low+high)/2)?5:10;
}

// These are prototype signal scores, not clinical severity scores.
const rows=[
 {name:"Fatigable ptosis", signal:!!(up&&up.eyeOpenRange>0.12), score:up?scale(up.eyeOpenRange,0.05,0.16):0,
  detail:"Change in estimated eye opening during sustained upgaze"},
 {name:"Cogan's lid-twitch", signal:false, score:0,
  detail:"Not classified automatically; webcam measurement is insufficient for a reliable clinical determination"},
 {name:"Curtain sign (enhanced ptosis)", signal:!!(up&&up.eyeOpenRange>0.18), score:up?scale(up.eyeOpenRange,0.10,0.22):0,
  detail:"Large change in estimated eyelid opening; requires clinical confirmation"},
 {name:"Peek sign", signal:!!(close&&close.meanAsym>0.06), score:close?scale(close.meanAsym,0.025,0.09):0,
  detail:"Estimated left/right eyelid asymmetry during closure task"},
 {name:"Variable/asymmetric ophthalmoparesis", signal:!!(horiz&&horiz.gazeXStd>0.035), score:horiz?scale(horiz.gazeXStd,0.015,0.055):0,
  detail:"Gaze-position variability; not a direct measurement of ophthalmoparesis"},
 {name:"Gaze-holding instability", signal:!!(horiz&&horiz.gazeXStd>0.045), score:horiz?scale(horiz.gazeXStd,0.02,0.07):0,
  detail:"Variation in estimated gaze position"},
 {name:"Diplopia-related head tilt/turn compensation", signal:!!(horiz&&horiz.headXStd>0.025), score:horiz?scale(horiz.headXStd,0.01,0.04):0,
  detail:"Head movement during gaze task; cannot establish diplopia"},
 {name:"Inter-visit variability", signal:false, score:0,
  detail:"Requires measurements from multiple separate visits; not determined in one session"},
 {name:"Intra-exam variability", signal:!!(horiz&&rep&&Math.abs(horiz.gazeXStd-rep.gazeXStd)>0.015), score:(horiz&&rep)?scale(Math.abs(horiz.gazeXStd-rep.gazeXStd),0.008,0.025):0,
  detail:"Difference between repeated same-session gaze measurements"}
];

const observed=rows.filter(x=>x.signal).length, notObserved=rows.length-observed;
new Chart(document.getElementById("pie"),{
 type:"pie",
 data:{labels:["Observed signal","Not observed"],datasets:[{data:[observed,notObserved]}]},
 options:{responsive:true,plugins:{legend:{position:"bottom"}}}
});
document.getElementById("pieLegend").innerHTML=`<p><b>${observed}</b> observational categories with a prototype signal; <b>${notObserved}</b> without one.</p>`;

document.getElementById("stats").innerHTML=`
<p><b>Tests completed:</b> ${tests.length}</p>
<p><b>Total samples:</b> ${data.global?.length||0}</p>
<p><b>Session started:</b> ${new Date(data.started).toLocaleString()}</p>
<p><b>Session finished:</b> ${data.finished?new Date(data.finished).toLocaleString():"—"}</p>`;

let html="<table><thead><tr><th>Category</th><th>Result</th><th>Prototype score</th><th>What was measured</th></tr></thead><tbody>";
for(const r of rows){
 html+=`<tr><td>${r.name}</td><td><span class="badge ${r.signal?"observed":"not-observed"}">${r.signal?"Observed signal":"Not observed"}</span></td><td class="score">${r.score}/10</td><td class="small">${r.detail}</td></tr>`;
}
html+="</tbody></table>";
document.getElementById("table").innerHTML=html;

const names=rows.filter(x=>x.signal).map(x=>x.name);
document.getElementById("summary").textContent =
 names.length
 ? `During this session, the prototype detected measurement patterns in ${names.length} of ${rows.length} requested categories: ${names.join(", ")}. These are webcam-derived observations only and should not be interpreted as confirmation of any clinical sign.`
 : `During this session, the prototype did not detect predefined measurement patterns in the requested categories. This does not rule out a clinical sign or medical condition.`;
