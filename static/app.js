import { FaceLandmarker, FilesetResolver } from
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs";

const TESTS = [
  {id:"upgaze",name:"Sustained upward gaze",duration:15,instruction:"Keep your head still and look at the target above the camera."},
  {id:"horizontal",name:"Horizontal gaze",duration:12,instruction:"Follow the target slowly from left to right using your eyes. Keep your head still."},
  {id:"vertical",name:"Vertical gaze",duration:12,instruction:"Follow the target slowly from top to bottom using your eyes. Keep your head still."},
  {id:"closure",name:"Eye-closure observation",duration:8,instruction:"Look at the camera. When prompted, gently close both eyes, then reopen them."},
  {id:"repeat",name:"Repeat gaze observation",duration:12,instruction:"Repeat the horizontal gaze task. Keep your head still."}
];

const video=document.getElementById("video"), canvas=document.getElementById("overlay");
const ctx=canvas.getContext("2d"), startBtn=document.getElementById("startBtn");
const beginBtn=document.getElementById("beginTestBtn"), stopBtn=document.getElementById("stopBtn");
const setup=document.getElementById("setup"), area=document.getElementById("testArea"), done=document.getElementById("doneArea");
const statusEl=document.getElementById("cameraStatus"), progress=document.getElementById("progress");
const testName=document.getElementById("testName"), instruction=document.getElementById("instruction");
const timerEl=document.getElementById("timer"), liveStatus=document.getElementById("liveStatus"), target=document.getElementById("target");

let stream=null, landmarker=null, testIndex=0, running=false, raf=null, timer=null;
let session={started:new Date().toISOString(), tests:[], global:[]};

async function initLandmarker(){
  const fileset=await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
  );
  landmarker=await FaceLandmarker.createFromOptions(fileset,{
    baseOptions:{modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"},
    runningMode:"VIDEO",numFaces:1,
    outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false
  });
}

startBtn.addEventListener("click", async ()=>{
  try {
      console.log("Start camera clicked");
    statusEl.textContent="Requesting camera permission…";
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;
    await video.play();
    await initLandmarker();
    setup.classList.add("hidden"); area.classList.remove("hidden");
    showTest();
    statusEl.textContent="";
  }catch(e){
    statusEl.textContent="Camera/model setup failed: "+e.message;
  }
};

function showTest(){
  const t=TESTS[testIndex];
  progress.textContent=`Test ${testIndex+1} of ${TESTS.length}`;
  testName.textContent=t.name; instruction.textContent=t.instruction;
  timerEl.textContent=t.duration+" s"; beginBtn.disabled=false;
  target.style.left="50%"; target.style.top="50%";
  liveStatus.textContent="Press Begin test when ready.";
}

beginBtn.addEventListener("click", runTest);
stopBtn.addEventListener("click", finish);

function runTest(){
  if(running)return; running=true; beginBtn.disabled=true;
  const t=TESTS[testIndex], samples=[], start=performance.now();
  let lastTime=-1;

  function sample(now){
    if(!running)return;
    const elapsed=(now-start)/1000;
    if(video.readyState>=2 && landmarker){
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
      const result=landmarker.detectForVideo(video,Math.round(now));
      const lm=result.faceLandmarks?.[0];
      if(lm){
        const s=measure(lm);
        samples.push({time:elapsed,...s});
        session.global.push({test:t.id,...s});
        draw(lm);
      }else{
        liveStatus.textContent="Face not detected — adjust position/lighting.";
      }
    }
    const left=Math.max(0,t.duration-elapsed);
    timerEl.textContent=left.toFixed(1)+" s";
    if(elapsed>=t.duration){completeTest(samples);return;}
    raf=requestAnimationFrame(sample);
  }
  raf=requestAnimationFrame(sample);
}

function measure(lm){
  // MediaPipe Face Landmarker indices used for approximate eye geometry.
  const L=[33,133,159,145], R=[362,263,386,374];
  const dist=(a,b)=>Math.hypot(lm[a].x-lm[b].x,lm[a].y-lm[b].y);
  const earL=(dist(L[2],L[3]))/(dist(L[0],L[1])||1);
  const earR=(dist(R[2],R[3]))/(dist(R[0],R[1])||1);
  const eyeOpen=(earL+earR)/2, asym=Math.abs(earL-earR);
  const leftEyeX=(lm[33].x+lm[133].x)/2, rightEyeX=(lm[362].x+lm[263].x)/2;
  const gazeX=(leftEyeX+rightEyeX)/2, gazeY=((lm[159].y+lm[145].y+lm[386].y+lm[374].y)/4);
  const headX=(lm[234].x+lm[454].x)/2, headY=(lm[10].y+lm[152].y)/2;
  return {eyeOpen,asym,gazeX,gazeY,headX,headY,faceDetected:true};
}

function draw(lm){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="rgba(31,111,235,.9)";
  [33,133,159,145,362,263,386,374].forEach(i=>{
    ctx.beginPath();ctx.arc(lm[i].x*canvas.width,lm[i].y*canvas.height,4,0,Math.PI*2);ctx.fill();
  });
}

function completeTest(samples){
  running=false;cancelAnimationFrame(raf);
  const t=TESTS[testIndex];
  const s=analyze(t,samples);
  session.tests.push(s);
  testIndex++;
  if(testIndex>=TESTS.length)finish(); else showTest();
}

function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function std(a){if(a.length<2)return 0;const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)**2)))}

function analyze(t,a){
  const valid=a.filter(x=>x.faceDetected);
  const open=valid.map(x=>x.eyeOpen), asym=valid.map(x=>x.asym);
  const gx=valid.map(x=>x.gazeX), gy=valid.map(x=>x.gazeY);
  const hx=valid.map(x=>x.headX), hy=valid.map(x=>x.headY);
  const result={id:t.id,name:t.name,samples:valid.length,duration:t.duration,
    meanEyeOpen:avg(open),eyeOpenRange:open.length?Math.max(...open)-Math.min(...open):0,
    meanAsym:avg(asym),gazeXStd:std(gx),gazeYStd:std(gy),
    headXStd:std(hx),headYStd:std(hy)};
  return result;
}

function finish(){
  running=false;cancelAnimationFrame(raf);clearInterval(timer);
  if(stream)stream.getTracks().forEach(x=>x.stop());
  session.finished=new Date().toISOString();
  localStorage.setItem("eyeObservationSession",JSON.stringify(session));
  area.classList.add("hidden");done.classList.remove("hidden");
}
document.getElementById("resultsBtn").addEventListener("click", () => {
   location.href="/results";
});
