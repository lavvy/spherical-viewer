//
// Spherical Viewer
//
// Copyright (c) 2017 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//

var spherical_viewer = function(opts) {

  'use strict';

  !function() {
    var hDiv = 32;
    var vDiv = hDiv << 1;
    var defaultOpts = {
      src : '',
      width : 640,
      height : 360,
      hDiv : hDiv,
      vDiv : vDiv,
      tMin : -Math.PI / 2,
      tMax : Math.PI / 2,
      zMin : -5,
      zMax : 5,
      att : 0.98,
      pRate : 1,
      maxTextureSize : 0
    };
    for (var k in defaultOpts) {
      if (typeof opts[k] == 'undefined') {
        opts[k] = defaultOpts[k];
      }
    }
  }();

  //---------------------------------------------------------------------

  var mat4 = function() {

    var fn = {
      concat : function(n) {
        var o = [];
        o.length = 16;
        for (var i = 0; i < o.length; i += 1) {
          var v = 0;
          for (var j = 0; j < 4; j += 1) {
            v += this[~~(i / 4) * 4 + j] * n[i % 4 + j * 4];
          }
          o[i] = v;
        }
        return mat4(o);
      },
      translateX : function(t) {
        return this.concat([
                           1, 0, 0, t,
                           0, 1, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1 ]);
      },
      translateY : function(t) {
        return this.concat([
                           1, 0, 0, 0,
                           0, 1, 0, t,
                           0, 0, 1, 0,
                           0, 0, 0, 1 ]);
      },
      translateZ : function(t) {
        return this.concat([
                           1, 0, 0, 0,
                           0, 1, 0, 0,
                           0, 0, 1, t,
                           0, 0, 0, 1 ]);
      },
      scaleX : function(s) {
        return this.concat([
                           s, 0, 0, 0,
                           0, 1, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1 ]);
      },
      scaleY : function(s) {
        return this.concat([
                           1, 0, 0, 0,
                           0, s, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1 ]);
      },
      scaleZ : function(s) {
        return this.concat([
                           1, 0, 0, 0,
                           0, 1, 0, 0,
                           0, 0, s, 0,
                           0, 0, 0, 1 ]);
      },
      rotateX : function(r) {
        var c = Math.cos(r);
        var s = Math.sin(r);
        return this.concat([
                           1, 0, 0, 0,
                           0, c,-s, 0,
                           0, s, c, 0,
                           0, 0, 0, 1 ]);
      },
      rotateY : function(r) {
        var c = Math.cos(r);
        var s = Math.sin(r);
        return this.concat([
                           c, 0, s, 0,
                           0, 1, 0, 0,
                          -s, 0, c, 0,
                           0, 0, 0, 1 ]);
      },
      rotateZ : function(r) {
        var c = Math.cos(r);
        var s = Math.sin(r);
        return this.concat([
                           c,-s, 0, 0,
                           s, c, 0, 0,
                           0, 0, 1, 0,
                           0, 0, 0, 1 ]);
      },
      translate : function(t) {
        return this.translateX(t.x || 0).translateY(t.y || 0).translateZ(t.z || 0);
      },
      scale : function(s) {
        if (typeof s == 'number') {
          return this.scale({ x : s, y : s, z : s });
        }
        return this.scaleX(s.x || 1).scaleY(s.y || 1).scaleZ(s.z || 1);
      }
    };

    fn.__proto__ = [].__proto__;

    var identity = function() {
      return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    };

    return function(m) {
      m = m || identity();
      m.__proto__ = fn;
      return m;
    };
  }();

  //---------------------------------------------------------------------

  var createShader = function(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    var res = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (res) {
      return shader;
    }
    var msg = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw 'createShader:' + msg;
  };

  var createProgram = function(gl, vertexShader, fragmentShader) {
    var pgm = gl.createProgram();
    gl.attachShader(pgm, vertexShader);
    gl.attachShader(pgm, fragmentShader);
    gl.linkProgram(pgm);
    var res = gl.getProgramParameter(pgm, gl.LINK_STATUS);
    if (res) {
      return pgm;
    }
    var msg = gl.getProgramInfoLog(pgm);
    gl.deleteProgram(pgm);
    throw 'createProgram:' + msg;
  };

  //---------------------------------------------------------------------

  var getSrc = function(id, src) {

    var dumpSrc = function(src) {
      var s = '';
      s = "getSrc('" + id + "',\n";
      var lineCount = 0;
      var lines = src.split(/[\r\n]+/g);
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        var index = line.indexOf('//');
        if (index != -1) {
          line = line.substring(0, index);
        }
        line = line.replace(/^\s+|\s+$/g, '').replace(/\s+/g, '\u0020');
        if (line.length == 0) {
          continue;
        }
        if (lineCount > 0) {
          s += ' +\n';
        }
        s += "  '" + line + "'";
        lineCount += 1;
      }
      s += ')';
      console.log(s);
    };

    if (debug) {
      var srcHolder = document.getElementById(id);
      if (!srcHolder) {
        return src;
      }
      src = srcHolder.text;
      dumpSrc(src);
      return src;
    } else {
      return src;
    }
  };

  var preparePgm = function() {
    var vs = createShader(gl, gl.VERTEX_SHADER,
        getSrc('vertex-shader1',
            'attribute vec4 aPosition;' +
            'uniform mat4 uMatrix;' +
            'attribute vec2 aTexcoord;' +
            'varying vec2 vTexcoord;' +
            'void main() {' +
            'gl_Position = uMatrix * aPosition;' +
            'vTexcoord = aTexcoord;' +
            '}') );
    var fs = createShader(gl, gl.FRAGMENT_SHADER,
        getSrc('fragment-shader1',
            'precision mediump float;' +
            'varying vec2 vTexcoord;' +
            'uniform sampler2D uTexture;' +
            'void main() {' +
            'gl_FragColor = texture2D(uTexture, vTexcoord);' +
            '}') );
    var pgm = createProgram(gl, vs, fs);
    gl.useProgram(pgm);
    return pgm;
  };

  var getRate = function() {
    return 1 + opts.pRate;
  };

  var eventSupport = function() {
    var lastPoint = null;
    var target = window;
    cv.addEventListener('mousedown', function(event) {
      event.preventDefault();
      lastPoint = { pageX : event.pageX, pageY : event.pageY };
      model.dragging = true;
      target.addEventListener('mousemove', doc_mousemoveHandler);
      target.addEventListener('mouseup', doc_mouseupHandler);
    });
    var doc_mousemoveHandler = function(event) {
      var ptz = getPTZ();
      if (!event.ctrlKey) {
        var p = ptz.p + (event.pageX - lastPoint.pageX) / model.r * getRate();
        var t = ptz.t + (event.pageY - lastPoint.pageY) / model.r * getRate();
        setPTZ(p, t, ptz.z);
      } else {
        var z = ptz.z + (event.pageY - lastPoint.pageY) / model.r * getRate();
        setPTZ(ptz.p, ptz.t, z);
      }
      lastPoint = { pageX : event.pageX, pageY : event.pageY };
    };
    var doc_mouseupHandler = function(event) {
      model.dragging = false;
      target.removeEventListener('mousemove', doc_mousemoveHandler);
      target.removeEventListener('mouseup', doc_mouseupHandler);
    };
    cv.addEventListener('wheel', function(event) {
      event.preventDefault();
      var ptz = getPTZ();
      setPTZ(ptz.p, ptz.t,
          ptz.z + event.deltaY / model.r * .1 * getRate() );
    });
  };

  var touchEventSupport = function() {
    var getPoints = function(event) {
      var points = [];
      for (var i = 0; i < event.touches.length; i += 1) {
        points.push({
          pageX : event.touches[i].pageX,
          pageY : event.touches[i].pageY
        });
      }
      return points;
    };
    var lastPoints = null;
    var target = window;
    cv.addEventListener('touchstart', function(event) {
      event.preventDefault();
      if (lastPoints == null) {
        lastPoints = getPoints(event);
        model.dragging = true;
        target.addEventListener('touchmove', doc_touchmoveHandler);
        target.addEventListener('touchend', doc_touchendHandler);
      }
    });
    var doc_touchmoveHandler = function(event) {
      var ptz = getPTZ();
      if (event.touches.length == 1 && lastPoints.length == 1) {
        var p = ptz.p +
          (event.touches[0].pageX - lastPoints[0].pageX) / model.r * getRate();
        var t = ptz.t +
          (event.touches[0].pageY - lastPoints[0].pageY) / model.r * getRate();
        setPTZ(p, t, ptz.z);
      } else if (event.touches.length == 2 && lastPoints.length == 2) {
        var d = function(o) {
          var dx = o[0].pageX - o[1].pageX;
          var dy = o[0].pageY - o[1].pageY;
          return Math.sqrt(dx * dx + dy * dy);
        };
        setPTZ(ptz.p, ptz.t,
            ptz.z + (d(event.touches) - d(lastPoints) ) / model.r * getRate() );
      }
      lastPoints = getPoints(event);
    };
    var doc_touchendHandler = function(event) {
      if (event.touches.length == 0) {
        lastPoints = null;
        model.dragging = false;
        target.removeEventListener('touchmove', doc_touchmoveHandler);
        target.removeEventListener('touchend', doc_touchendHandler);
      }
    };
  };

  var setPTZ = function(p, t, z) {
    t = Math.max(opts.tMin, Math.min(t, opts.tMax) );
    z = Math.max(opts.zMin, Math.min(z, opts.zMax) );
    var moved = model.p != p || model.t != t || model.z != z;
    if (moved) {
      model.p = p;
      model.t = t;
      model.z = z;
      model.valid = false;
    }
  };

  var getPTZ = function() {
    return { p : model.p, t : model.t, z : model.z };
  };

  var doMotion = function() {

    var attParam = function(id) {

      var vid = 'v' + id;
      var val = 0;

      var vBuf = [];
      var vBufIdx = 0;
      var vBufLen = 8;

      var getV = function() {
        var v = 0;
        for (var i = 0; i < vBuf.length; i += 1) {
          v += vBuf[i];
        }
        return v / vBuf.length;
      };
      var putV = function(v) {
        if (vBuf.length < vBufLen) {
          vBuf.push(v);
        } else {
          vBuf[vBufIdx] = v;
          vBufIdx = (vBufIdx + 1) % vBufLen;
        }
      };

      return {
        val : function() { return val; },
        delta : function(dt) {
          if (model.dragging) {
            putV( (model[id] - last[id]) / dt);
            model[vid] = getV();
          } else {
            val = model[id] + model[vid] * dt;
            model[vid] *= opts.att;
          }
        }
      };
    };

    var limit = 1E-6;
    var last = null;

    var p = attParam('p');
    var t = attParam('t');
    var z = attParam('z');

    return function(dt) {
      if (last != null) {
        p.delta(dt);
        t.delta(dt);
        z.delta(dt);
        var v = Math.sqrt(model.vp * model.vp +
            model.vt * model.vt + model.vz * model.vz);
        if (v < limit) {
          model.vp = 0;
          model.vt = 0;
          model.vz = 0;
        }
        if (!model.dragging) {
          setPTZ(p.val(), t.val(), z.val() );
        }
      }
      last = { p : model.p, t : model.t, z : model.z };
    };
  }();

  var getFullscreenApiNames = function(target) {
    if (target.requestFullscreen) {
      return {
        requestFullscreen : 'requestFullscreen',
        exitFullscreen : 'exitFullscreen',
        fullscreenEnabled : 'fullscreenEnabled',
        fullscreenElement : 'fullscreenElement',
        fullscreenchange : 'fullscreenchange'
      };
    } else if (target.webkitRequestFullscreen) {
      return {
        requestFullscreen : 'webkitRequestFullscreen',
        exitFullscreen : 'webkitExitFullscreen',
        fullscreenEnabled : 'webkitFullscreenEnabled',
        fullscreenElement : 'webkitFullscreenElement',
        fullscreenchange : 'webkitfullscreenchange'
      };
    } else if (cv.mozRequestFullScreen) {
      return {
        requestFullscreen : 'mozRequestFullScreen',
        exitFullscreen : 'mozCancelFullScreen',
        fullscreenEnabled : 'mozFullScreenEnabled',
        fullscreenElement : 'mozFullScreenElement',
        fullscreenchange : 'mozfullscreenchange'
      };
    } else if (cv.msRequestFullscreen) {
      return {
        requestFullscreen : 'msRequestFullscreen',
        exitFullscreen : 'msExitFullscreen',
        fullscreenEnabled : 'msFullscreenEnabled',
        fullscreenElement : 'msFullscreenElement',
        fullscreenchange : 'msfullscreenchange'
      };
    } else {
      return null;
    }
  };

  var fullscreenSupport = function() {

    var orgState = null;
    var fullscreened = false;

    var startFullscreen = function() {

      orgState = {
        width : cv.width,
        height : cv.height,
        scrollLeft :  document.body.scrollLeft,
        scrollTop : document.body.scrollTop
      };
      cv.style.position = 'absolute';
      cv.style.left = '0px';
      cv.style.top = '0px';
      document.body.style.overflow = 'hidden';
      document.body.scrollLeft = 0;
      document.body.scrollTop = 0;

      var lastSize = { width : 0, height : 0 };

      var watchWindow = function() {

        if (!fullscreened) {
          // exit fullscreen.
          cv.style.position = '';
          cv.style.left = '';
          cv.style.top = '';
          document.body.style.overflow = '';
          document.body.scrollLeft = orgState.scrollLeft;
          document.body.scrollTop = orgState.scrollTop;
          cv.width = orgState.width;
          cv.height = orgState.height;
          return;
        }

        var size = { width : window.innerWidth, height : window.innerHeight };
        var resized = lastSize.width != size.width ||
          lastSize.height != size.height;
        if (resized) {
          cv.width = size.width;
          cv.height = size.height;
          lastSize = size;
        }
        window.setTimeout(watchWindow, 50);
      };
      watchWindow();
    };

    var names = getFullscreenApiNames(cv);

    if (!names || !document[names.fullscreenEnabled]) {
      return function() {
        fullscreened = !fullscreened;
        if (fullscreened) {
          startFullscreen();
        }
      };
    }

    var fullscreenchangeHandler = function(event) {
      fullscreened = !!document[names.fullscreenElement];
      if (fullscreened) {
        startFullscreen();
      } else {
        document.removeEventListener(names.fullscreenchange,
            fullscreenchangeHandler);
      }
    };

    return function() {
      if (!document[names.fullscreenElement]) {
        document.addEventListener(names.fullscreenchange,
            fullscreenchangeHandler);
        cv[names.requestFullscreen]();
      } else {
        document[names.exitFullscreen]();
      }
    };
  };

  var update = function(now) {

    if (model.lastTime != 0) {
      doMotion(now - model.lastTime);
    }
    model.lastTime = now;

    var resized = model.width != gl.canvas.width ||
      model.height != gl.canvas.height;
    if (resized) {
      model.width = gl.canvas.width;
      model.height = gl.canvas.height;
      gl.viewport(0, 0, model.width, model.height);
      model.valid = false;
    }

    if (!model.valid) {
      updateScene();
      model.valid = true;
    }

    window.requestAnimationFrame(update);
  };

  //---------------------------------------------------------------------

  var createDebugImage = function(size) {

    var cv = document.createElement('canvas');
    cv.setAttribute('width', '' + size);
    cv.setAttribute('height', '' + (size >> 1) );

    var ctx = cv.getContext('2d');
    ctx.strokeStyle = 'none';

    ctx.fillStyle = '#666666';
    ctx.fillRect(0, 0, size, size >> 1);

    var hDiv = 8;
    var vDiv = hDiv / 2;
    var unit = size / hDiv;
    var colors = ['#ff0000', '#00ff00', '#0000ff', '#ffcc00'];
    for (var h = 0; h < hDiv; h += 1) {
      for (var v = 0; v < vDiv; v+= 1) {
        if ( (h + v) % 2 == 0) {
          ctx.fillStyle = colors[h % colors.length];
          ctx.fillRect(h * unit, v * unit, unit, unit);
        }
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = (size >> 4) + 'px sans-serif';
    ctx.fillText('Spherical Viewer', size >> 1, size >> 2);

    return cv;
  };

  var prepareTexture = function() {

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0,
        gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([63, 63, 63]) );

    var loadImage = function(img) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      model.valid = false;
    };

    var size = +gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (opts.maxTextureSize) {
      size = Math.min(size, opts.maxTextureSize);
    }
    if (debug) {
      opts.src = createDebugImage(size);
    }

    if (typeof opts.src == 'string') {
      var img_loadHandler = function() {
        var w = size;
        var h = size >> 1;
        var cv = document.createElement('canvas');
        cv.setAttribute('width', '' + w);
        cv.setAttribute('height', '' + h);
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        loadImage(cv);
      };
      var img = new Image();
      img.addEventListener('load', img_loadHandler);
      img.crossOrigin = 'anonymous';
      img.src = opts.src;
    } else {
      loadImage(opts.src);
    }
  };

  var prepareScene = function() {

    var vDiv = opts.vDiv;
    var hDiv = opts.hDiv;
    var vt = [];
    var tx = [];
    var addPoint = function(h, v, vOffset) {
      var p = 2 * Math.PI * h / hDiv;
      var t = Math.PI * ( (v + vOffset) / vDiv - 0.5);
      t = Math.sin(t) * Math.PI / 2; // liner to sine (-PI/2 ~ PI/2)
      vt.push(Math.cos(p) * Math.cos(t) );
      vt.push(Math.sin(t) );
      vt.push(Math.sin(p) * Math.cos(t) );
      tx.push(p / (2 * Math.PI) + v);
      tx.push(1 - (t / Math.PI + 0.5) );
    };
    for (var v = 0; v < vDiv; v += 1) {
      for (var h = 0; h < hDiv; h += 1) {
        addPoint(h, v, v == 0? 0 : h / hDiv);
        addPoint(h, v, v == vDiv - 1? 1 : h / hDiv + 1);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tx), gl.STATIC_DRAW);

    var aTexcoordLoc = gl.getAttribLocation(pgm, 'aTexcoord');
    gl.enableVertexAttribArray(aTexcoordLoc);
    gl.vertexAttribPointer(aTexcoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vt), gl.STATIC_DRAW);

    var aPositionLoc = gl.getAttribLocation(pgm, 'aPosition');
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

    return vt.length / 3;
  };

  var updateScene = function() {

    model.r = model.width * Math.exp(Math.log(1.5) * model.z);
    var w = model.width;
    var h = model.height;

    var pmat = mat4();
    pmat[2 * 4 + 3] = opts.pRate;

    var mat = mat4().
      rotateY(model.p - Math.PI / 2).
      rotateX(-model.t).concat(pmat).scale(model.r).
      scale({x : -1 / w, y : 1 / h, z : 1 / model.r}).
      translateZ(-0.1);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var uMatrixLoc = gl.getUniformLocation(pgm, 'uMatrix');
    gl.uniformMatrix4fv(uMatrixLoc, false, mat);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, model.numPoints);
  };

  //---------------------------------------------------------------------

  var debug = location.protocol == 'file:';

  var cv = document.createElement('canvas');
  cv.setAttribute('width', '' + opts.width);
  cv.setAttribute('height', '' + opts.height);
  cv.style.cursor = 'all-scroll';

  var gl = cv.getContext('webgl') ||
    cv.getContext('experimental-webgl', { preserveDrawingBuffer: true });

  if (!gl) {
    console.log('gl not supported.');
    return null;
  }

  var model = {
    valid : false,
    lastTime : 0,
    width : 0,
    height : 0,
    numPoints : 0,
    r : 0,
    p : 0,
    t : 0,
    z : 0,
    vp : 0,
    vt : 0,
    vz : 0,
    dragging : false
  };

  var pgm = preparePgm();

  prepareTexture();
  model.numPoints = prepareScene();

  if (typeof window.ontouchstart != 'undefined') {
    touchEventSupport();
  } else {
    eventSupport();
  }

  var toggleFullscreen = fullscreenSupport();

  window.requestAnimationFrame(update);

  return {
    canvas : cv,
    setPTZ : setPTZ,
    getPTZ : getPTZ,
    toggleFullscreen : toggleFullscreen
  };
};

!function(spherical_viewer) {
  if (typeof exports === 'object') {
    module.exports = spherical_viewer;
  }
}(spherical_viewer);
