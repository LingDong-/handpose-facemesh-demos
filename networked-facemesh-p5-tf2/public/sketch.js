// sketch.js
// aka the client side:
// - use facemesh to track face skeleton
// - send to server via socket.io
// - update display with other users' faces from server

// First of all, shut glitch up about p5's global namespace pollution using this magic comment:
/* global describe p5 setup draw P2D WEBGL ARROW CROSS face MOVE TEXT WAIT HALF_PI PI QUARTER_PI TAU TWO_PI DEGREES RADIANS DEG_TO_RAD RAD_TO_DEG CORNER CORNERS RADIUS RIGHT LEFT CENTER TOP BOTTOM BASELINE POINTS LINES LINE_STRIP LINE_LOOP TRIANGLES TRIANGLE_FAN TRIANGLE_STRIP QUADS QUAD_STRIP TESS CLOSE OPEN CHORD PIE PROJECT SQUARE ROUND BEVEL MITER RGB HSB HSL AUTO ALT BACKSPACE CONTROL DELETE DOWN_ARROW ENTER ESCAPE LEFT_ARROW OPTION RETURN RIGHT_ARROW SHIFT TAB UP_ARROW BLEND REMOVE ADD DARKEST LIGHTEST DIFFERENCE SUBTRACT EXCLUSION MULTIPLY SCREEN REPLACE OVERLAY HARD_LIGHT SOFT_LIGHT DODGE BURN THRESHOLD GRAY OPAQUE INVERT POSTERIZE DILATE ERODE BLUR NORMAL ITALIC BOLD BOLDITALIC LINEAR QUADRATIC BEZIER CURVE STROKE FILL TEXTURE IMMEDIATE IMAGE NEAREST REPEAT CLAMP MIRROR LANDSCAPE PORTRAIT GRID AXES frameCount deltaTime focused cursor frameRate getFrameRate setFrameRate noCursor displayWidth displayHeight windowWidth windowHeight width height fullscreen pixelDensity displayDensity getURL getURLPath getURLParams pushStyle popStyle popMatrix pushMatrix registerPromisePreload camera perspective ortho frustum createCamera setCamera setAttributes createCanvas resizeCanvas noCanvas createGraphics blendMode noLoop loop push pop redraw applyMatrix resetMatrix rotate rotateX rotateY rotateZ scale shearX shearY translate arc ellipse circle line point quad rect square triangle ellipseMode noSmooth rectMode smooth strokeCap strokeJoin strokeWeight bezier bezierDetail bezierPoint bezierTangent curve curveDetail curveTightness curvePoint curveTangent beginContour beginShape bezierVertex curveVertex endContour endShape quadraticVertex vertex alpha blue brightness color green hue lerpColor lightness red saturation background clear colorMode fill noFill noStroke stroke erase noErase createStringDict createNumberDict storeItem getItem clearStorage removeItem select selectAll removeElements createDiv createP createSpan createImg createA createSlider createButton createCheckbox createSelect createRadio createColorPicker createInput createFileInput createVideo createAudio VIDEO AUDIO createCapture createElement deviceOrientation accelerationX accelerationY accelerationZ pAccelerationX pAccelerationY pAccelerationZ rotationX rotationY rotationZ pRotationX pRotationY pRotationZ pRotateDirectionX pRotateDirectionY pRotateDirectionZ turnAxis setMoveThreshold setShakeThreshold isKeyPressed keyIsPressed key keyCode keyIsDown movedX movedY mouseX mouseY pmouseX pmouseY winMouseX winMouseY pwinMouseX pwinMouseY mouseButton mouseIsPressed requestPointerLock exitPointerLock touches createImage saveCanvas saveGif saveFrames loadImage image tint noTint imageMode pixels blend copy filter get loadPixels set updatePixels loadJSON loadStrings loadTable loadXML loadBytes httpGet httpPost httpDo createWriter save saveJSON saveJSONObject saveJSONArray saveStrings saveTable writeFile downloadFile abs ceil constrain dist exp floor lerp log mag map max min norm pow round sq sqrt fract createVector noise noiseDetail noiseSeed randomSeed random randomGaussian acos asin atan atan2 cos sin tan degrees radians angleMode textAlign textLeading textSize textStyle textWidth textAscent textDescent loadFont text textFont append arrayCopy concat reverse shorten shuffle sort splice subset float int str boolean byte char unchar hex unhex join match matchAll nf nfc nfp nfs split splitTokens trim day hour minute millis month second year plane box sphere cylinder cone ellipsoid torus orbitControl debugMode noDebugMode ambientLight specularColor directionalLight pointLight lights lightFalloff spotLight noLights loadModel model loadShader createShader shader resetShader normalMaterial texture textureMode textureWrap ambientMaterial emissiveMaterial specularMaterial shininess remove canvas drawingContext*/
// Also socket.io, tensorflow and facemesh's:
/* global describe facemesh tf io*/
// Also in landmarks.js
/* global describe VTX7 VTX33 VTX68 VTX468 TRI7 TRI33 TRI68 TRI468*/
// now any other lint errors will be your own problem

// A choice for number of keypoints: 7,33,68,468

// === bare minimum 7 points ===
// var VTX = VTX7;

// === important facial feature 33 points ===
// var VTX = VTX33;

// === standard facial landmark 68 points ===
var VTX = VTX68;

// === full facemesh 468 points ===
// var VTX = VTX468;

// select the right triangulation based on vertices
var TRI = VTX == VTX7 ? TRI7 : (VTX == VTX33 ? TRI33 : (VTX == VTX68 ? TRI68 : TRI468))

var MAX_FACES = 4; //default 10


var socket = io(); // the networking library

var facemeshModel = null; // this will be loaded with the facemesh model
                          // WARNING: do NOT call it 'model', because p5 already has something called 'model'

var videoDataLoaded = false; // is webcam capture ready?

var statusText = "Loading facemesh model...";

var myFaces = []; // faces detected in this browser
                  // currently facemesh only supports single face, so this will be either empty or singleton

var capture; // webcam capture, managed by p5.js

var serverData = {} // stores other users's faces from the server

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
})


function setup() {
  createCanvas(window.innerWidth,window.innerHeight);
  capture = createCapture(VIDEO);
  
  // this is to make sure the capture is loaded before asking facemesh to take a look
  // otherwise facemesh will be very unhappy
  capture.elt.onloadeddata = function(){
    console.log("video initialized");
    videoDataLoaded = true;
  }
  
  capture.hide();
}


// draw a face object returned by facemesh
function drawFaces(faces,filled){
  
  
  for (var i = 0; i < faces.length; i++){
    const keypoints = faces[i].scaledMesh;

    for (var j = 0; j < keypoints.length; j++) {
      const [x, y, z] = keypoints[j];
      circle(x,y,5);
      push();
      strokeWeight(1);
      text(j,x,y);
      pop()
    }
    
    // select the triangulation based on number of keypoints
    var tri = keypoints.length == 468 ? TRI468 : (keypoints.length == 68 ? TRI68 : (keypoints.length == 33 ? TRI33 : TRI7))
    for (var j = 0; j < tri.length; j+=3){
      var a = keypoints[tri[j  ]];
      var b = keypoints[tri[j+1]];
      var c = keypoints[tri[j+2]];
      
      if (filled){
        var d = [(a[0]+b[0]+c[0])/6, (a[1]+b[1]+c[1])/6];
        var color = get(...d);
        fill(color);
        noStroke();
      }
      triangle(
        a[0],a[1],
        b[0],b[1],
        c[0],c[1],
      )
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

function draw() {
  strokeJoin(ROUND); //otherwise super gnarly
  
  if (facemeshModel && videoDataLoaded){ // model and video both loaded, 
    facemeshModel.pipeline.maxFaces = MAX_FACES;
    facemeshModel.estimateFaces(capture.elt).then(function(_faces){
      // we're faceling an async promise
      // best to avoid drawing something here! it might produce weird results due to racing
      
      myFaces = _faces.map(x=>packFace(x,VTX)); // update the global myFaces object with the detected faces

      // console.log(myFaces);
      if (!myFaces.length){
        // haven't found any faces
        statusText = "Show some faces!"
      }else{
        // display the confidence, to 3 decimal places
        statusText = "Confidence: "+ (Math.round(_faces[0].faceInViewConfidence*1000)/1000);
        
      }
      
      // tell the server about our updates!
      socket.emit('client-update',{faces:myFaces});
    })
  }
  
  background(200);
  
  // first draw the debug video and annotations
  push();
  scale(0.5); // downscale the webcam capture before drawing, so it doesn't take up too much screen sapce
  image(capture, 0, 0, capture.width, capture.height);
  noFill();
  stroke(255,0,0);
  drawFaces(myFaces); // draw my face skeleton
  pop();
  
  
  // now draw all the other users' faces (& drawings) from the server
  push()
  
  scale(2);
  for (var userId in serverData){
    if (userId == socket.id){ // thick line for me
      strokeWeight(3);
    }else{ // thin line for everyone else
      strokeWeight(1);
    }

    stroke(...uuid2color(userId).map(x=>x*0.5)); // unique color computed from user id
    noFill();
    drawFaces(serverData[userId].faces);
    
    
  }
  pop();
  
  push();
  fill(255,0,0);
  text(statusText,2,60);
  pop();
}