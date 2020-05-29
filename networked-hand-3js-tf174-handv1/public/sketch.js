// sketch.js
// aka the client side:
// - use handpose to track hand skeleton
// - send to server via socket.io
// - update display with other users' hands from server

/* global describe handpose tf io THREE*/

var socket = io(); // the networking library

var handposeModel = null; // this will be loaded with the handpose model

var videoDataLoaded = false; // is webcam capture ready?

var statusText = "Loading handpose model...";

var myHands = []; // hands detected in this browser
                  // currently handpose only supports single hand, so this will be either empty or singleton

var serverData = {} // stores other users's hands from the server


var handMeshes = {}; // these are threejs objects that makes up the rendering of the hands
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
  
  camera.position.z = capture.videoWidth/2; // rough estimate for suitable camera distance based on FOV
}


// certian materials require a light source, which you can add here:
// var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
// scene.add( directionalLight );


// update threejs object position and orientation according to data sent from server
// threejs has a "scene" model, so we don't have to specify what to draw each frame,
// instead we put objects at right positions and threejs renders them all
function updateMeshesFromServerData(){

  // first, we add the newly appeared hands from the server
  for (var userId in serverData){
    if (!handMeshes[userId] && serverData[userId].hands.length){
      handMeshes[userId] = [];
      
      for (var i = 0; i < 21; i++){ // 21 keypoints
        var {isPalm,next} = getLandmarkProperty(i);

        var obj = new THREE.Object3D(); // a parent object to facilitate rotation/scaling
        
        // we make each bone a cylindrical shape, but you can use your own models here too
        var geometry = new THREE.CylinderGeometry( isPalm?5:10, 5, 1);
        
        var material = new THREE.MeshNormalMaterial();
        // another possible material (after adding a light source):
        // var material = new THREE.MeshPhongMaterial({color:0x00ffff});
        
        var mesh = new THREE.Mesh( geometry, material );
        mesh.rotation.x = Math.PI/2;
        
        obj.add( mesh );
        scene.add(obj);
        handMeshes[userId].push(obj);
      }
    }
  }
  // next, we remove the hands that are already gone in the server
  for (var userId in handMeshes){
    if (!serverData[userId] || !serverData[userId].hands.length){
      for (var i = 0; i < handMeshes[userId].length; i++){
        scene.remove( handMeshes[userId][i] );
      }
      delete handMeshes[userId];
    }
  }
  // you can potentially change the above logic to something a bit smarter:
  // - don't remove a hand as soon as it disappears, instead give it a chance and wait couple more
  //   frames and see if it comes back
  // - if one user is gone but another just came in, instead of removing a bunch of meshes and adding
  //   a bunch again, recycle by reassigning the meshes
  
  // move the meshes and orient them
  for (var userId in handMeshes){
    if (!serverData[userId] || !serverData[userId].hands.length){
      // we checked this before, doing it again in case we modify previous logic
      continue;
    }
    for (var i = 0; i < handMeshes[userId].length; i++){
      
      var {isPalm,next} = getLandmarkProperty(i);
      
      var p0 = webcam2space(...serverData[userId].hands[0].landmarks[i   ]);  // one end of the bone
      var p1 = webcam2space(...serverData[userId].hands[0].landmarks[next]);  // the other end of the bone
      
      // compute the center of the bone (midpoint)
      var mid = p0.clone().lerp(p1,0.5);
      handMeshes[userId][i].position.set(mid.x,mid.y,mid.z);
      
      // compute the length of the bone
      handMeshes[userId][i].scale.z = p0.distanceTo(p1);
      
      // compute orientation of the bone
      handMeshes[userId][i].lookAt(p1);
    }
  }
}


// Load the MediaPipe handpose model assets.
handpose.load().then(function(_model){
  console.log("model initialized.")
  statusText = "Model loaded."
  handposeModel = _model;
})

// tell the server we're ready!
socket.emit('client-start')

// update our data everytime the server sends us an update
socket.on('server-update', function(data){
  serverData = data;
  updateMeshesFromServerData();
})

// compute some metadata given a landmark index
// - is the landmark a palm keypoint or a finger keypoint?
// - what's the next landmark to connect to if we're drawing a bone?
function getLandmarkProperty(i){
  var palms = [0,1,2,5,9,13,17] //landmark indices that represent the palm

  var idx = palms.indexOf(i);
  var isPalm = idx != -1;
  var next; // who to connect with?
  if (!isPalm){ // connect with previous finger landmark if it's a finger landmark
    next = i-1;
  }else{ // connect with next palm landmark if it's a palm landmark
    next = palms[(idx+1)%palms.length];
  }
  return {isPalm,next};
}

// draw a hand object (2D debug view) returned by handpose
function drawHands(hands,noKeypoints){
  
  // Each hand object contains a `landmarks` property,
  // which is an array of 21 3-D landmarks.
  for (var i = 0; i < hands.length; i++){

    var landmarks = hands[i].landmarks;

    var palms = [0,1,2,5,9,13,17] //landmark indices that represent the palm

    for (var j = 0; j < landmarks.length; j++){
      var [x,y,z] = landmarks[j]; // coordinate in 3D space

      // draw the keypoint and number
      if (!noKeypoints){
        dbg.fillRect(x-2,y-2,4,4);
        dbg.fillText(j,x,y);
      }
        
      // draw the skeleton
      var {isPalm,next} = getLandmarkProperty(j);
      dbg.beginPath();
      dbg.moveTo(x,y);
      dbg.lineTo(...landmarks[next]);
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

function render() {
  requestAnimationFrame(render); // this creates an infinite animation loop
    
  if (handposeModel && videoDataLoaded){ // model and video both loaded
    
    handposeModel.estimateHands(capture).then(function(_hands){
      // we're handling an async promise
      // best to avoid drawing something here! it might produce weird results due to racing
      
      myHands = _hands; // update the global myHands object with the detected hands
      if (!myHands.length){
        // haven't found any hands
        statusText = "Show some hands!"
      }else{
        // display the confidence, to 3 decimal places
        statusText = "Confidence: "+ (Math.round(myHands[0].handInViewConfidence*1000)/1000);
        
      }
      
      // tell the server about our updates!
      socket.emit('client-update',{hands:myHands});
    })
  }
  
  dbg.clearRect(0,0,dbg.canvas.width,dbg.canvas.height);
  
  dbg.save();
  dbg.fillStyle="red";
  dbg.strokeStyle="red";
  dbg.scale(0.5,0.5); //halfsize;
  
  dbg.drawImage(capture,0,0);
  drawHands(myHands);
  dbg.restore();
  
  dbg.save();
  dbg.fillStyle="red";
  dbg.fillText(statusText,2,60);
  dbg.restore();
  
  // render the 3D scene!
  renderer.render( scene, camera );
}

render(); // kick off the rendering loop!