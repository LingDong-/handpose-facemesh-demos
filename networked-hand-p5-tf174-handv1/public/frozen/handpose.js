// copy of https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose
// uses local model url in case tfjs decides to break/abandom something
/**
    * @license
    * Copyright 2020 Google LLC. All Rights Reserved.
    * Licensed under the Apache License, Version 2.0 (the "License");
    * you may not use this file except in compliance with the License.
    * You may obtain a copy of the License at
    *
    * http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing, software
    * distributed under the License is distributed on an "AS IS" BASIS,
    * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    * See the License for the specific language governing permissions and
    * limitations under the License.
    * =============================================================================
    */
!function(t, n) {
    "object" == typeof exports && "undefined" != typeof module ? n(exports, require("@tensorflow/tfjs-core"), require("@tensorflow/tfjs-converter")) : "function" == typeof define && define.amd ? define(["exports", "@tensorflow/tfjs-core", "@tensorflow/tfjs-converter"], n) : n(t.handpose = {}, t.tf, t.tf)
}(this, function(t, n, e) {
    "use strict";
    function o(t) {
        return [Math.abs(t.endPoint[0] - t.startPoint[0]), Math.abs(t.endPoint[1] - t.startPoint[1])]
    }
    function s(t) {
        return [t.startPoint[0] + (t.endPoint[0] - t.startPoint[0]) / 2, t.startPoint[1] + (t.endPoint[1] - t.startPoint[1]) / 2]
    }
    function i(t, n=1.5) {
        const e = s(t)
          , i = o(t)
          , r = [n * i[0] / 2, n * i[1] / 2];
        return {
            startPoint: [e[0] - r[0], e[1] - r[1]],
            endPoint: [e[0] + r[0], e[1] + r[1]],
            palmLandmarks: t.palmLandmarks
        }
    }
    function r(t) {
        const n = s(t)
          , e = o(t)
          , i = Math.max(...e) / 2;
        return {
            startPoint: [n[0] - i, n[1] - i],
            endPoint: [n[0] + i, n[1] + i],
            palmLandmarks: t.palmLandmarks
        }
    }
    function a(t, n) {
        const e = [t.endPoint[0] - t.startPoint[0], t.endPoint[1] - t.startPoint[1]]
          , o = [e[0] * n[0], e[1] * n[1]];
        return {
            startPoint: [t.startPoint[0] + o[0], t.startPoint[1] + o[1]],
            endPoint: [t.endPoint[0] + o[0], t.endPoint[1] + o[1]],
            palmLandmarks: t.palmLandmarks
        }
    }
    class d {
        constructor(t, e, o, s, i, r) {
            this.model = t,
            this.width = e,
            this.height = o,
            this.iouThreshold = i,
            this.scoreThreshold = r,
            this.anchors = s.map(t=>[t.x_center, t.y_center]),
            this.anchorsTensor = n.tensor2d(this.anchors),
            this.inputSizeTensor = n.tensor1d([e, o]),
            this.doubleInputSizeTensor = n.tensor1d([2 * e, 2 * o])
        }
        normalizeBoxes(t) {
            return n.tidy(()=>{
                const e = n.slice(t, [0, 0], [-1, 2])
                  , o = n.slice(t, [0, 2], [-1, 2])
                  , s = n.add(n.div(e, this.inputSizeTensor), this.anchorsTensor)
                  , i = n.div(o, this.doubleInputSizeTensor)
                  , r = n.mul(n.sub(s, i), this.inputSizeTensor)
                  , a = n.mul(n.add(s, i), this.inputSizeTensor);
                return n.concat2d([r, a], 1)
            }
            )
        }
        normalizeLandmarks(t, e) {
            return n.tidy(()=>{
                const o = n.add(n.div(t.reshape([-1, 7, 2]), this.inputSizeTensor), this.anchors[e]);
                return n.mul(o, this.inputSizeTensor)
            }
            )
        }
        async getBoundingBoxes(t) {
            const e = n.tidy(()=>n.mul(n.sub(t, .5), 2))
              , o = n.env().get("WEBGL_PACK_DEPTHWISECONV");
            n.env().set("WEBGL_PACK_DEPTHWISECONV", !0);
            const s = this.model.predict(e);
            n.env().set("WEBGL_PACK_DEPTHWISECONV", o);
            const i = s.squeeze()
              , r = n.tidy(()=>n.sigmoid(n.slice(i, [0, 0], [-1, 1])).squeeze())
              , a = n.slice(i, [0, 1], [-1, 4])
              , d = this.normalizeBoxes(a)
              , h = console.warn;
            console.warn = (()=>{}
            );
            const c = n.image.nonMaxSuppression(d, r, 1, this.iouThreshold, this.scoreThreshold);
            console.warn = h;
            const u = await c.array()
              , l = [e, s, c, i, d, a, r];
            if (0 === u.length)
                return l.forEach(t=>t.dispose()),
                null;
            const m = u[0]
              , f = n.slice(d, [m, 0], [1, -1])
              , p = n.slice(i, [m, 5], [1, 14])
              , P = n.tidy(()=>this.normalizeLandmarks(p, m).reshape([-1, 2]));
            return l.push(p),
            l.forEach(t=>t.dispose()),
            {
                boxes: f,
                palmLandmarks: P
            }
        }
        async estimateHandBounds(t) {
            const e = t.shape[1]
              , o = t.shape[2]
              , s = n.tidy(()=>t.resizeBilinear([this.width, this.height]).div(255))
              , i = await this.getBoundingBoxes(s);
            if (null === i)
                return s.dispose(),
                null;
            const r = i.boxes.arraySync()
              , a = r[0].slice(0, 2)
              , d = r[0].slice(2, 4)
              , h = i.palmLandmarks.arraySync();
            return s.dispose(),
            i.boxes.dispose(),
            i.palmLandmarks.dispose(),
            c = {
                startPoint: a,
                endPoint: d,
                palmLandmarks: h
            },
            u = [o / this.width, e / this.height],
            {
                startPoint: [c.startPoint[0] * u[0], c.startPoint[1] * u[1]],
                endPoint: [c.endPoint[0] * u[0], c.endPoint[1] * u[1]],
                palmLandmarks: c.palmLandmarks.map(t=>[t[0] * u[0], t[1] * u[1]])
            };
            var c, u
        }
    }
    const h = {
        thumb: [1, 2, 3, 4],
        indexFinger: [5, 6, 7, 8],
        middleFinger: [9, 10, 11, 12],
        ringFinger: [13, 14, 15, 16],
        pinky: [17, 18, 19, 20],
        palmBase: [0]
    };
    function c(t, n) {
        const e = Math.PI / 2 - Math.atan2(-(n[1] - t[1]), n[0] - t[0]);
        return (o = e) - 2 * Math.PI * Math.floor((o + Math.PI) / (2 * Math.PI));
        var o
    }
    const u = (t,n)=>[[1, 0, t], [0, 1, n], [0, 0, 1]];
    function l(t, n) {
        let e = 0;
        for (let o = 0; o < t.length; o++)
            e += t[o] * n[o];
        return e
    }
    function m(t, n) {
        const e = [];
        for (let o = 0; o < t.length; o++)
            e.push(t[o][n]);
        return e
    }
    function f(t, n) {
        const e = []
          , o = t.length;
        for (let s = 0; s < o; s++) {
            e.push([]);
            for (let i = 0; i < o; i++)
                e[s].push(l(t[s], m(n, i)))
        }
        return e
    }
    function p(t, n) {
        const e = Math.cos(t)
          , o = Math.sin(t)
          , s = [[e, -o, 0], [o, e, 0], [0, 0, 1]];
        return f(f(u(n[0], n[1]), s), u(-n[0], -n[1]))
    }
    function P(t, n) {
        return [l(t, n[0]), l(t, n[1])]
    }
    const g = .8
      , b = [0, -.4]
      , k = 3
      , x = [0, -.1]
      , y = 1.65
      , L = [0, 5, 9, 13, 17, 1, 2]
      , B = 0
      , I = 2;
    class w {
        constructor(t, n, e, o, s, i) {
            this.regionsOfInterest = [],
            this.runsWithoutHandDetector = 0,
            this.boundingBoxDetector = t,
            this.meshDetector = n,
            this.maxContinuousChecks = s,
            this.detectionConfidence = i,
            this.meshWidth = e,
            this.meshHeight = o,
            this.maxHandsNumber = 1
        }
        getBoxForPalmLandmarks(t, n) {
            const e = t.map(t=>{
                return P([...t, 1], n)
            }
            );
            return i(r(a(this.calculateLandmarksBoundingBox(e), b)), k)
        }
        getBoxForHandLandmarks(t) {
            const n = i(r(a(this.calculateLandmarksBoundingBox(t), x)), y)
              , e = [];
            for (let n = 0; n < L.length; n++)
                e.push(t[L[n]].slice(0, 2));
            return n.palmLandmarks = e,
            n
        }
        transformRawCoords(t, n, e, i) {
            const r = o(n)
              , a = [r[0] / this.meshWidth, r[1] / this.meshHeight]
              , d = t.map(t=>[a[0] * (t[0] - this.meshWidth / 2), a[1] * (t[1] - this.meshHeight / 2), t[2]])
              , h = p(e, [0, 0])
              , c = d.map(t=>{
                return [...P(t, h), t[2]]
            }
            )
              , u = function(t) {
                const n = [[t[0][0], t[1][0]], [t[0][1], t[1][1]]]
                  , e = [t[0][2], t[1][2]]
                  , o = [-l(n[0], e), -l(n[1], e)];
                return [n[0].concat(o[0]), n[1].concat(o[1]), [0, 0, 1]]
            }(i)
              , m = [...s(n), 1]
              , f = [l(m, u[0]), l(m, u[1])];
            return c.map(t=>[t[0] + f[0], t[1] + f[1], t[2]])
        }
        async estimateHand(t) {
            const e = this.shouldUpdateRegionsOfInterest();
            if (!0 === e) {
                const n = await this.boundingBoxDetector.estimateHandBounds(t);
                if (null === n)
                    return t.dispose(),
                    this.regionsOfInterest = [],
                    null;
                this.updateRegionsOfInterest(n, !0),
                this.runsWithoutHandDetector = 0
            } else
                this.runsWithoutHandDetector++;
            const o = this.regionsOfInterest[0]
              , i = c(o.palmLandmarks[B], o.palmLandmarks[I])
              , r = s(o)
              , a = [r[0] / t.shape[2], r[1] / t.shape[1]];
            let d;
            const h = n.getBackend();
            if (h.match("webgl"))
                d = function(t, e, o, s) {
                    const i = t.shape
                      , r = i[1]
                      , a = i[2]
                      , d = Math.sin(e)
                      , h = Math.cos(e)
                      , c = Math.floor(a * ("number" == typeof s ? s : s[0]))
                      , u = Math.floor(r * ("number" == typeof s ? s : s[1]));
                    let l = "";
                    const m = {
                        variableNames: ["Image"],
                        outputShape: i,
                        userCode: `\n      void main() {\n        ivec4 coords = getOutputCoords();\n        int x = coords[2];\n        int y = coords[1];\n        int coordX = int(float(x - ${c}) * ${h} -\n          float(y - ${u}) * ${d});\n        int coordY = int(float(x - ${c}) * ${d} +\n          float(y - ${u}) * ${h});\n        coordX = int(coordX + ${c});\n        coordY = int(coordY + ${u});\n\n        ${l = "number" == typeof o ? `float outputValue = ${o.toFixed(2)};` : `\n      vec3 fill = vec3(${o.join(",")});\n      float outputValue = fill[coords[3]];`}\n\n        if(coordX > 0 && coordX < ${a} && coordY > 0 && coordY < ${r}) {\n          outputValue = getImage(coords[0], coordY, coordX, coords[3]);\n        }\n\n      setOutput(outputValue);\n    }`
                    };
                    return n.backend().compileAndRun(m, [t])
                }(t, i, 0, a);
            else {
                if ("cpu" !== h && "tensorflow" !== h)
                    throw new Error(`Handpose is not yet supported by the ${h} ` + "backend - rotation kernel is not defined.");
                d = function(t, e, o, s) {
                    const i = n.backend()
                      , r = n.buffer(t.shape, t.dtype)
                      , [a,d,h,c] = t.shape
                      , u = h * ("number" == typeof s ? s : s[0])
                      , l = d * ("number" == typeof s ? s : s[1])
                      , m = Math.sin(-e)
                      , f = Math.cos(-e)
                      , p = i.readSync(t.dataId);
                    for (let t = 0; t < a; t++)
                        for (let n = 0; n < d; n++)
                            for (let e = 0; e < h; e++)
                                for (let s = 0; s < c; s++) {
                                    const i = [a, n, e, s]
                                      , P = i[2]
                                      , g = i[1];
                                    let b = (P - u) * f - (g - l) * m
                                      , k = (P - u) * m + (g - l) * f;
                                    b = Math.round(b + u),
                                    k = Math.round(k + l);
                                    let x = o;
                                    "number" != typeof o && (x = 3 === s ? 255 : o[s]),
                                    b >= 0 && b < h && k >= 0 && k < d && (x = p[t * h * d * c + k * (h * c) + b * c + s]);
                                    const y = t * h * d * c + n * (h * c) + e * c + s;
                                    r.values[y] = x
                                }
                    return r.toTensor()
                }(t, i, 0, a)
            }
            const u = p(-i, r);
            let l;
            const m = function(t, e, o) {
                const s = e.shape[1]
                  , i = e.shape[2]
                  , r = [[t.startPoint[1] / s, t.startPoint[0] / i, t.endPoint[1] / s, t.endPoint[0] / i]];
                return n.image.cropAndResize(e, r, [0], o)
            }(l = !0 === e ? this.getBoxForPalmLandmarks(o.palmLandmarks, u) : o, d, [this.meshWidth, this.meshHeight])
              , f = m.div(255);
            m.dispose(),
            d.dispose();
            const P = n.env().get("WEBGL_PACK_DEPTHWISECONV");
            n.env().set("WEBGL_PACK_DEPTHWISECONV", !0);
            const [g,b] = this.meshDetector.predict(f);
            n.env().set("WEBGL_PACK_DEPTHWISECONV", P),
            f.dispose();
            const k = g.dataSync()[0];
            if (g.dispose(),
            k < this.detectionConfidence)
                return b.dispose(),
                this.regionsOfInterest = [],
                null;
            const x = n.reshape(b, [-1, 3])
              , y = x.arraySync();
            b.dispose(),
            x.dispose();
            const L = this.transformRawCoords(y, l, i, u)
              , w = this.getBoxForHandLandmarks(L);
            return this.updateRegionsOfInterest(w, !1),
            {
                landmarks: L,
                handInViewConfidence: k,
                boundingBox: {
                    topLeft: w.startPoint,
                    bottomRight: w.endPoint
                }
            }
        }
        calculateLandmarksBoundingBox(t) {
            const n = t.map(t=>t[0])
              , e = t.map(t=>t[1]);
            return {
                startPoint: [Math.min(...n), Math.min(...e)],
                endPoint: [Math.max(...n), Math.max(...e)]
            }
        }
        updateRegionsOfInterest(t, n) {
            if (n)
                this.regionsOfInterest = [t];
            else {
                const n = this.regionsOfInterest[0];
                let e = 0;
                if (null != n && null != n.startPoint) {
                    const [o,s] = t.startPoint
                      , [i,r] = t.endPoint
                      , [a,d] = n.startPoint
                      , [h,c] = n.endPoint
                      , u = Math.max(o, a)
                      , l = Math.max(s, d)
                      , m = (Math.min(i, h) - u) * (Math.min(r, c) - l);
                    e = m / ((i - o) * (r - s) + (h - a) * (c - s) - m)
                }
                this.regionsOfInterest[0] = e > g ? n : t
            }
        }
        shouldUpdateRegionsOfInterest() {
            return this.regionsOfInterest.length !== this.maxHandsNumber || this.runsWithoutHandDetector >= this.maxContinuousChecks
        }
    }
    const M = 256
      , C = 256;
    class H {
        constructor(t) {
            this.pipeline = t
        }
        static getAnnotations() {
            return h
        }
        async estimateHands(t, e=!1) {
            const [,o] = function(t) {
                return t instanceof n.Tensor ? [t.shape[0], t.shape[1]] : [t.height, t.width]
            }(t)
              , s = n.tidy(()=>(t instanceof n.Tensor || (t = n.browser.fromPixels(t)),
            t.toFloat().expandDims(0)))
              , i = await this.pipeline.estimateHand(s);
            if (s.dispose(),
            null === i)
                return [];
            let r = i;
            !0 === e && (r = function(t, n) {
                const {handInViewConfidence: e, landmarks: o, boundingBox: s} = t;
                return {
                    handInViewConfidence: e,
                    landmarks: o.map(t=>[n - 1 - t[0], t[1], t[2]]),
                    boundingBox: {
                        topLeft: [n - 1 - s.topLeft[0], s.topLeft[1]],
                        bottomRight: [n - 1 - s.bottomRight[0], s.bottomRight[1]]
                    }
                }
            }(i, o));
            const a = {};
            for (const t of Object.keys(h))
                a[t] = h[t].map(t=>r.landmarks[t]);
            return [{
                handInViewConfidence: r.handInViewConfidence,
                boundingBox: r.boundingBox,
                landmarks: r.landmarks,
                annotations: a
            }]
        }
    }
    t.load = async function({maxContinuousChecks: t=1 / 0, detectionConfidence: o=.8, iouThreshold: s=.3, scoreThreshold: i=.5}={}) {
        const [r,a,h] = await Promise.all([async function() {
          //https://tfhub.dev/mediapipe/tfjs-model/handskeleton/1/default/1/anchors.json?tfjs-format=file
            return n.util.fetch("models/anchors.json").then(t=>t.json())
        }(), async function() {
          //https://tfhub.dev/mediapipe/tfjs-model/handdetector/1/default/1
            return e.loadGraphModel("models/handdetector/", {
                fromTFHub: !0
            })
        }(), async function() {
          //https://tfhub.dev/mediapipe/tfjs-model/handskeleton/1/default/1
            return e.loadGraphModel("models/handskeleton/", {
                fromTFHub: !0
            })
        }()])
          , c = new d(a,M,C,r,s,i)
          , u = new w(c,h,M,C,t,o);
        return new H(u)
    }
    ,
    t.HandPose = H,
    Object.defineProperty(t, "__esModule", {
        value: !0
    })
});
