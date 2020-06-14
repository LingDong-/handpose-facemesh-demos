# pull app source codes from glitch.com
# if you happen to be me, put the authentication token in a file called `auth`, and run `sh pull.sh`

rm -rf mediapipe-hand-3js-tf174-handv1
rm -rf networked-hand-3js-tf174-handv1
rm -rf mediapipe-hand-p5-tf174-handv1
rm -rf networked-hand-p5-tf174-handv1

AUTH=`cat auth`

curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=18e1da53-23a7-43ab-b48f-5cbc1f5e92a7" > 1.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=38ea4653-d12a-4b24-92a8-7bd401954108" > 2.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=720ed9e3-09af-471e-83c6-15870358a59c" > 3.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=c88be22d-76a4-4b22-8d15-1264b6cd2d60" > 4.tgz


tar -xvzf 1.tgz
mv app mediapipe-hand-3js-tf174-handv1

tar -xvzf 2.tgz
mv app networked-hand-3js-tf174-handv1

tar -xvzf 3.tgz
mv app mediapipe-hand-p5-tf174-handv1

tar -xvzf 4.tgz
mv app networked-hand-p5-tf174-handv1

rm 1.tgz
rm 2.tgz
rm 3.tgz
rm 4.tgz

rm -rf */.*


rm -rf mediapipe-facemesh-3js-tf2
rm -rf networked-facemesh-3js-tf2
rm -rf mediapipe-facemesh-p5-tf2
rm -rf networked-facemesh-p5-tf2

AUTH=`cat auth`


curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=8d8d4775-6c2e-49a8-b300-1d6cb9f02062" > 1.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=922e7059-15af-4708-8c47-4cd6378d12d2" > 2.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=5a7ee19f-3b3a-4fbd-90c8-f785df7144a6" > 3.tgz
curl "https://api.glitch.com/project/download/?authorization=$AUTH&projectId=b03e62f7-7f66-4c2e-8218-7dd509227162" > 4.tgz


tar -xvzf 1.tgz
mv app mediapipe-facemesh-3js-tf2

tar -xvzf 2.tgz
mv app networked-facemesh-3js-tf2

tar -xvzf 3.tgz
mv app mediapipe-facemesh-p5-tf2

tar -xvzf 4.tgz
mv app networked-facemesh-p5-tf2

rm 1.tgz
rm 2.tgz
rm 3.tgz
rm 4.tgz

rm -rf */.*


