// sketch.js
// aka the client side:
// - use facemesh to track face skeleton
// - send to server via socket.io
// - update display with other users' faces from server

/* global describe facemesh tf io THREE*/
/* global describe VTX7 VTX33 VTX68 VTX468 TRI7 TRI33 TRI68 TRI468 UV7 UV33 UV68 UV468*/

// A choice for number of keypoints: 7,33,68,468

// === bare minimum 7 points ===
// var VTX = VTX7;

// === important facial feature 33 points ===
var VTX = VTX33;

// === standard facial landmark 68 points ===
// var VTX = VTX68;

// === full facemesh 468 points ===
// var VTX = VTX468;

// select the right triangulation based on vertices
var TRI = VTX == VTX7 ? TRI7 : (VTX == VTX33 ? TRI33 : (VTX == VTX68 ? TRI68 : TRI468))
var UV  = VTX == VTX7 ? UV7  : (VTX == VTX33 ? UV33  : (VTX == VTX68 ? UV68  : UV468))

var MAX_FACES = 4; //default 10


var socket = io(); // the networking library

var facemeshModel = null; // this will be loaded with the facemesh model

var videoDataLoaded = false; // is webcam capture ready?

var statusText = "Loading facemesh model...";

var myFaces = []; // faces detected in this browser
                  // currently facemesh only supports single face, so this will be either empty or singleton

var serverData = {} // stores other users's faces from the server


var faceMeshes = {}; // these are threejs objects that makes up the rendering of the faces
                     // stored as { userId : Array<Object3D> }

// html canvas for drawing debug view
var dbg = document.createElement("canvas").getContext('2d');
dbg.canvas.style.position="absolute";
dbg.canvas.style.left = "0px";
dbg.canvas.style.top = "0px";
dbg.canvas.style.zIndex = 100; // "bring to front"
document.body.appendChild(dbg.canvas);


// boilerplate to initialize threejs scene
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.1, 1000 );
var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// read video from webcam
var capture = document.createElement("video");
// capture.playsinline="playsinline"
// capture.autoplay="autoplay"
navigator.mediaDevices.getUserMedia({audio:false,video:true}).then(function(stream){
  capture.setAttribute("playsinline", "");
  window.stream = stream;
  capture.srcObject = stream;
  capture.play();
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
  
  camera.position.z = capture.videoWidth/2; // rough estimate for suitable camera distance based on FOV
}


// certain materials require a light source, which you can add here:
// var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
// scene.add( directionalLight );

// const material = new THREE.MeshBasicMaterial({color:0xFF00FF});
const material = new THREE.MeshNormalMaterial();
// const material = new THREE.MeshLambertMaterial({color:0xFF00FF});

// update threejs object position and orientation according to data sent from server
// threejs has a "scene" model, so we don't have to specify what to draw each frame,
// instead we put objects at right positions and threejs renders them all
function updateMeshesFromServerData(){
  
  // first, we add the newly appeared faces from the server
  for (var userId in serverData){
    if (!faceMeshes[userId] && serverData[userId].faces.length){
      faceMeshes[userId] = [];
    }
    while(faceMeshes[userId].length < serverData[userId].faces.length){
      const geom = new THREE.Geometry();
      for (var i = 0; i < VTX.length; i ++){
        geom.vertices.push(new THREE.Vector3(i,0,0));
      }
      for (var i = 0; i < TRI.length; i+=3){
        geom.faces.push(
          new THREE.Face3(TRI[i], TRI[i+1], TRI[i+2]),
        );
        geom.faceVertexUvs[0].push(
          [ new THREE.Vector2(UV[TRI[i  ]][0],1-UV[TRI[i  ]][1]),
            new THREE.Vector2(UV[TRI[i+1]][0],1-UV[TRI[i+1]][1]),
            new THREE.Vector2(UV[TRI[i+2]][0],1-UV[TRI[i+2]][1]),
          ],
        )
      }
      var mesh = new THREE.Mesh(geom,material);
      scene.add(mesh);
      faceMeshes[userId].push(mesh);
    }
  }
  // next, we remove the faces that are already gone in the server
  for (var userId in faceMeshes){
    var serverCount = serverData[userId] ? serverData[userId].faces.length : 0;
    for (var i = faceMeshes[userId].length-1; i >= serverCount; i--){
      scene.remove( faceMeshes[userId][i] );
      faceMeshes[userId].splice(i,1);
    }
  }
  // you can potentially change the above logic to something a bit smarter:
  // - don't remove a face as soon as it disappears, instead give it a chance and wait couple more
  //   frames and see if it comes back
  // - if one user is gone but another just came in, instead of removing a bunch of meshes and adding
  //   a bunch again, recycle by reassigning the meshes
  
  // update vertices
  for (var userId in faceMeshes){
    if (!serverData[userId]){
      // we checked this before, doing it again in case we modify previous logic
      continue;
    }
    for (var i = 0; i < Math.min(faceMeshes[userId].length, serverData[userId].faces.length); i++){
      
      let geom = faceMeshes[userId][i].geometry;
      let targ = serverData[userId].faces[i].scaledMesh;
      for (var j = 0; j < targ.length; j++){
        var p = webcam2space(...targ[j]);
        // console.log(p)
        geom.vertices[j].set(p.x,p.y,p.z);
      }
      
      geom.computeVertexNormals();
      // geom.computeFaceNormals();
      geom.verticesNeedUpdate = true;
    }
  }
  
}

// Load the MediaPipe facemesh model assets.
facemesh.load().then(function(_model){
  console.log("model initialized.")
  statusText = "Model loaded."
  facemeshModel = _model;
})

// tell the server we're ready!
socket.emit('client-start')

// update our data everytime the server sends us an update
socket.on('server-update', function(data){
  serverData = data;
  updateMeshesFromServerData();
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
      
      // tell the server about our updates!
      socket.emit('client-update',{faces:myFaces});
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