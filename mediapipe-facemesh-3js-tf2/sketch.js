// sketch.js

/* global describe facemesh tf io THREE dat*/
/* global describe VTX7 VTX33 VTX68 VTX468 TRI7 TRI33 TRI68 TRI468 UV7 UV33 UV68 UV468*/

const TEXTURE_MODES = [
  "normal",
  "video",
  "shaded",
  "texture",
  "texture-shaded",
]
const NORMAL_MODES = [
  "vertex",
  "face",
]
const KEYPOINT_MODES = {
  VTX7,
  VTX33,
  VTX68,
  VTX468,
}
var queries={};try{queries = Object.fromEntries(window.location.href.split("?")[1].split("&").map(x=>x.split("=")));}catch(_){}

// === CONFIGS ===
//                                                     r--------change the defaults here
//                                                     v
var TEXTURE_MODE = queries["texture-mode"]        || "normal";
var NORMAL_MODE = queries["normal-mode"]          || "vertex";
var VTX = KEYPOINT_MODES[queries["keypoint-mode"] || "VTX468"];

// select the right triangulation based on vertices
var TRI = VTX == VTX7 ? TRI7 : (VTX == VTX33 ? TRI33 : (VTX == VTX68 ? TRI68 : TRI468))
var UV  = VTX == VTX7 ? UV7  : (VTX == VTX33 ? UV33  : (VTX == VTX68 ? UV68  : UV468))

var MAX_FACES = 4; //default 10

var facemeshModel = null; // this will be loaded with the facemesh model

var videoDataLoaded = false; // is webcam capture ready?

var statusText = "Loading facemesh model...";

var myFaces = []; // faces detected in this browser
                  // currently facemesh only supports single face, so this will be either empty or singleton

var faceMeshes = []; // these are threejs objects that makes up the rendering of the faces
                     // stored as { userId : Array<Object3D> }

// html canvas for drawing debug view
var dbg = document.createElement("canvas").getContext('2d');
dbg.canvas.style.position="absolute";
dbg.canvas.style.left = "0px";
dbg.canvas.style.top = "0px";
dbg.canvas.style.zIndex = 100; // "bring to front"
document.body.appendChild(dbg.canvas);

var tex = document.createElement("canvas").getContext('2d');
tex.canvas.style.position="absolute";
tex.canvas.style.left = "0px";
tex.canvas.style.top = "0px";
tex.canvas.style.zIndex = -100; // "send to back"
tex.canvas.style.pointerEvents = "none";
tex.canvas.style.opacity = 0;
document.body.appendChild(tex.canvas);

// boilerplate to initialize threejs scene
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 1000 );
var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// read video from webcam
var capture = document.createElement("video");
capture.playsinline="playsinline"
capture.autoplay="autoplay"
navigator.mediaDevices.getUserMedia({audio:false,video:true}).then(function(stream){
  window.stream = stream;
  capture.srcObject = stream;
})

// hide the video element
capture.style.position="absolute"
capture.style.opacity= 0
capture.style.zIndex =-100 // "send to back"

// signal when capture is ready and set size for debug canvas
capture.onloadeddata = function(){
  console.log("video initialized");
  videoDataLoaded = true;
  dbg.canvas.width = capture.videoWidth /2; // half size
  dbg.canvas.height= capture.videoHeight/2;
  
  tex.canvas.width = capture.videoWidth ; // half size
  tex.canvas.height= capture.videoHeight;
  
  camera.position.z = capture.videoWidth/2; // rough estimate for suitable camera distance based on FOV
}


if (TEXTURE_MODE.includes("shaded")){
  var light = new THREE.AmbientLight( 0x666666 ); // soft white light
  scene.add( light );
  var directionalLight = new THREE.DirectionalLight( 0xffffff, 3.0 );
  directionalLight.position.set( -2,3,1 );
  scene.add( directionalLight );
}

var texture;
var material;

if (TEXTURE_MODE == "normal"){
  material = new THREE.MeshNormalMaterial();
  
}else if (TEXTURE_MODE == "video"){
  texture = new THREE.CanvasTexture(tex.canvas);
  material = new THREE.MeshBasicMaterial({ map : texture });
  
}else if (TEXTURE_MODE == "texture"){
  texture = new THREE.TextureLoader().load( 'assets/facemesh_test_texture.png' );
  material = new THREE.MeshBasicMaterial({ map : texture });
  
}else if (TEXTURE_MODE == "texture-shaded"){
  texture = new THREE.TextureLoader().load( 'assets/facemesh_test_texture.png' );
  material = new THREE.MeshLambertMaterial({ map : texture });  

}else if (TEXTURE_MODE == "shaded"){
  material = new THREE.MeshLambertMaterial({ color : 0x777777 });  
}


// update threejs object position and orientation according to data sent from server
// threejs has a "scene" model, so we don't have to specify what to draw each frame,
// instead we put objects at right positions and threejs renders them all
function updateMeshes(faces){
  var imgData;
  
  while(faceMeshes.length < faces.length){
    const geom = new THREE.Geometry();
    for (var i = 0; i < 468; i ++){
      geom.vertices.push(new THREE.Vector3(i,0,0));
    }
    for (var i = 0; i < TRI.length; i+=3){
      geom.faces.push(
        new THREE.Face3(TRI[i], TRI[i+1], TRI[i+2]),
      );
      
      if (TEXTURE_MODE == "texture" || TEXTURE_MODE == "texture-shaded"){
        geom.faceVertexUvs[0].push(
          [ new THREE.Vector2(UV[TRI[i  ]][0],1-UV[TRI[i  ]][1]),
            new THREE.Vector2(UV[TRI[i+1]][0],1-UV[TRI[i+1]][1]),
            new THREE.Vector2(UV[TRI[i+2]][0],1-UV[TRI[i+2]][1]),
          ],
        )
      }
    }
    var mesh = new THREE.Mesh(geom,material);
    scene.add(mesh);
    faceMeshes.push(mesh);
  }
  // next, we remove the extra meshes
  while (faceMeshes.length > faces.length){
    scene.remove(faceMeshes.pop() );
    
  }
 
  for (var i = 0; i < faceMeshes.length; i++){

    let geom = faceMeshes[i].geometry;
    let targ = faces[i].scaledMesh;
    for (var j = 0; j < targ.length; j++){
      var p = webcam2space(...targ[j]);
      geom.vertices[j].set(p.x,p.y,p.z);
    }
    
    for (var j = 0; j < TRI.length; j+=3){
      if (!geom.faceVertexUvs[0][j/3]){
        geom.faceVertexUvs[0][j/3] = [new THREE.Vector2(),new THREE.Vector2(),new THREE.Vector2()]
      }
      if (TEXTURE_MODE == "video"){
        geom.faceVertexUvs[0][j/3][0].x =  targ[TRI[j  ]][0]/tex.canvas.width;
        geom.faceVertexUvs[0][j/3][0].y =1-targ[TRI[j  ]][1]/tex.canvas.height;
        geom.faceVertexUvs[0][j/3][1].x =  targ[TRI[j+1]][0]/tex.canvas.width;
        geom.faceVertexUvs[0][j/3][1].y =1-targ[TRI[j+1]][1]/tex.canvas.height;
        geom.faceVertexUvs[0][j/3][2].x =  targ[TRI[j+2]][0]/tex.canvas.width;
        geom.faceVertexUvs[0][j/3][2].y =1-targ[TRI[j+2]][1]/tex.canvas.height;
      }
    }
    if (NORMAL_MODE == "vertex"){
      geom.computeVertexNormals();
    }else if (NORMAL_MODE == "face"){
      geom.computeFaceNormals();
    }
    geom.verticesNeedUpdate = true;
    
    if (TEXTURE_MODE == "video"){
      geom.uvsNeedUpdate = true;
    }
  }
}


// Load the MediaPipe facemesh model assets.
facemesh.load().then(function(_model){
  console.log("model initialized.")
  statusText = "Model loaded."
  facemeshModel = _model;
})


// draw a face object (2D debug view) returned by facemesh
function drawFaces(faces,noKeypoints){
  for (var i = 0; i < faces.length; i++){
    const keypoints = faces[i].scaledMesh;

    for (var j = 0; j < TRI.length; j+=3){
      var a = keypoints[TRI[j  ]];
      var b = keypoints[TRI[j+1]];
      var c = keypoints[TRI[j+2]];
      
      dbg.beginPath();
      dbg.moveTo(a[0],a[1]);
      dbg.lineTo(b[0],b[1]);
      dbg.lineTo(c[0],c[1]);
      dbg.closePath();
      dbg.stroke();
    }
  }
}

// hash to a unique color for each user ID
function uuid2color(uuid){
  var col = 1;
  for (var i = 0; i < uuid.length; i++){
    var cc = uuid.charCodeAt(i);
    col = (col*cc) % 0xFFFFFF;
  }
  return [(col >> 16) & 0xff, (col >> 8) & 0xff, col & 0xff]
}

// transform webcam coordinates to threejs 3d coordinates
function webcam2space(x,y,z){
  return new THREE.Vector3(
     (x-capture.videoWidth /2),
    -(y-capture.videoHeight/2), // in threejs, +y is up
    - z
  )
}



// reduce vertices to the desired set, and compress data as well
function packFace(face,set){
  var ret = {
    scaledMesh:[],
  }
  for (var i = 0; i < set.length; i++){
    var j = set[i];
    ret.scaledMesh[i] = [
      Math.floor(face.scaledMesh[j][0]*100)/100,
      Math.floor(face.scaledMesh[j][1]*100)/100,
      Math.floor(face.scaledMesh[j][2]*100)/100,
    ]
  }
  return ret;
}

// the main render loop
function render() {
  requestAnimationFrame(render); // this creates an infinite animation loop
    
  if (facemeshModel && videoDataLoaded){ // model and video both loaded
    facemeshModel.pipeline.maxFaces = MAX_FACES;
    facemeshModel.estimateFaces(capture).then(function(_faces){
      // we're faceling an async promise
      // best to avoid drawing something here! it might produce weird results due to racing
      
      myFaces = _faces.map(x=>packFace(x,VTX));  // update the global myFaces object with the detected faces
      if (!myFaces.length){
        // haven't found any faces
        statusText = "Show some faces!"
      }else{
        // display the confidence, to 3 decimal places
        statusText = "Confidence: "+ (Math.round(myFaces[0].faceInViewConfidence*1000)/1000);
      }
      tex.drawImage(capture,0,0);
      
      if (TEXTURE_MODE == "video"){
        texture.needsUpdate = true;
      }
      updateMeshes(myFaces);
    })
  }
  
  dbg.clearRect(0,0,dbg.canvas.width,dbg.canvas.height);
  
  dbg.save();
  dbg.fillStyle="red";
  dbg.strokeStyle="red";
  dbg.scale(0.5,0.5); //halfsize;
  
  dbg.drawImage(capture,0,0);
  drawFaces(myFaces);
  dbg.restore();
  
  dbg.save();
  dbg.fillStyle="red";
  dbg.fillText(statusText,2,60);
  dbg.restore();
  
  // render the 3D scene!
  renderer.render( scene, camera );
}

render(); // kick off the rendering loop!


// reload the page when settings updated
function reload(){
  window.location.href = window.location.href.split("?")[0]+"?"+Object.entries(queries).map(x=>x[0]+"="+x[1]).join("&")
}


// ------------ some GUI sliders -------------


const datGui  = new dat.GUI({ autoPlace: true });

datGui.domElement.id = 'gui' 

var ctrlTextureMode = datGui.add(window,'TEXTURE_MODE',Object.fromEntries(TEXTURE_MODES.map(x=>[x,x]))).name('Texture Mode');

ctrlTextureMode.onFinishChange(function(value) {
  queries["texture-mode"] = value;
  reload();
});


var ctrlNormalMode = datGui.add(window,'NORMAL_MODE',Object.fromEntries(NORMAL_MODES.map(x=>[x,x]))).name('Normal Mode');

ctrlNormalMode.onFinishChange(function(value) {
  queries["normal-mode"] = value;
  reload();
});


var ctrlKeypointMode = datGui.add({VTX:"VTX"+VTX.length},'VTX',Object.fromEntries(Object.keys(KEYPOINT_MODES).map(x=>[x,x]))).name('Keypoint Mode');

ctrlKeypointMode.onFinishChange(function(value) {
  queries["keypoint-mode"] = value;
  reload();
});

// maybe a reload button
// datGui.add({ reload },'reload').name("Update (Reload)")