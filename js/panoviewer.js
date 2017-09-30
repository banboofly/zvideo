var planar_vertex_data = new Float32Array([
    -1.0,-1.0,0.0,   0.0, 1.0,
    -1.0,1.0,0.0,    0.0, 0.0,
    1.0,-1.0,0.0,    1.0, 1.0,
    1.0,1.0,0.0,     1.0, 0.0,
    1.0,-1.0,0.0,    0.0, 1.0,
    1.0,1.0,0.0,     0.0, 0.0,
    1.0,-1.0,0.0,    1.0, 1.0,
    1.0,1.0,0.0,     1.0, 0.0
]);
var planar_index_data = new Uint16Array([0, 1, 2, 1, 2, 3, 4, 5, 6, 5, 6, 7]);

var spheric_vertex_data;
var spheric_index_data;

var planar_vshader = "attribute vec4 in_position; attribute vec2 in_texcoord; varying vec2 v_texcoord; void main(){ gl_Position = in_position; v_texcoord = in_texcoord;}";
var spheric_vshader = "attribute vec4 in_position; attribute vec2 in_texcoord; varying vec2 v_texcoord; uniform mat4 mvp; void main() { gl_Position = mvp * in_position; v_texcoord = in_texcoord;}";
var fshader = "precision mediump float; varying vec2 v_texcoord; uniform sampler2D sampler; void main() { gl_FragColor = texture2D(sampler, v_texcoord); }";

var planar_program = 0;
var planar_position_ptr;
var planar_texcoord_ptr;
var planar_vertex_buffer;
var planar_index_buffer;
var planar_loc_sampler;

var spheric_program = 0;
var spheric_position_ptr;
var spheric_texcoord_ptr;
var spheric_vertex_buffer;
var spheric_index_buffer;
var spheric_loc_sampler;

var curr_program;
var curr_position_ptr;
var curr_texcoord_ptr;
var curr_vertex_buffer;
var curr_index_buffer;
var curr_loc_sampler;
var curr_index_length;

var loc_mvp;

var PLANAR_MODEL = 0;
var SPHERIC_MODEL = 1;
var LITTLE_PLANET_MODEL = 2;
var FISHEYE_MODEL = 3;

var BINOCULAR = false;

var IDENTITY_MATRIX = new Float32Array([
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,    
]);
var AXIS_Y = new Float32Array([0.0, -1.0, 0.0]);
var AXIS_Z = new Float32Array([0.0, 0.0, 1.0]);
var ORIGNAL = new Float32Array([0.0, 0.0, 0.0]);


var mvp_center;
var mvp_left;
var mvp_right;

var gl;
var curr_model = PLANAR_MODEL;

function create_spheric_model(rows, cols) {
    var i, j, curr_i, next_i;
    var alpha, beta;
    var tx = 1.0 / (cols-1);
    var ty = 1.0 / (rows-1);
    var index = 0;

    spheric_vertex_data = new Float32Array(rows*cols*5);
    spheric_index_data = new Uint16Array((rows-1)*(cols-1)*6);

    for (i=0; i<rows; i++) {
        for (j=0; j<cols; j++) {
            
            alpha = (tx*j - 0.5) * Math.PI*2.0;
            beta = (ty*i - 0.5) * Math.PI;
            
            spheric_vertex_data[index++] = Math.cos(beta) * Math.sin(alpha);
            spheric_vertex_data[index++] = Math.sin(beta);
            spheric_vertex_data[index++] = Math.cos(beta) * Math.cos(alpha);

            spheric_vertex_data[index++] = tx*j;
            spheric_vertex_data[index++] = ty*i;
        }
    }

    index = 0;
    for (i=0; i<rows-1; i++) {
        curr_i = i * cols;
        next_i = (i + 1) * cols;
        for (j=0; j<cols-1; j++) {

            spheric_index_data[index++] = curr_i + j;
            spheric_index_data[index++] = next_i + j;
            spheric_index_data[index++] = curr_i + j + 1;
            
            spheric_index_data[index++] = curr_i + j + 1;
            spheric_index_data[index++] = next_i + j;
            spheric_index_data[index++] = next_i + j + 1;
        }
    }
}

function quat_to_matrix(quat) {
    var xx = quat[0] * quat[0];
    var xy = quat[0] * quat[1];
    var xz = quat[0] * quat[2];
    var xw = quat[0] * quat[3];
    var yy = quat[1] * quat[1];
    var yz = quat[1] * quat[2];
    var yw = quat[1] * quat[3];
    var zz = quat[2] * quat[2];
    var zw = quat[2] * quat[3];
    
    var matrix = new Float32Array(16);
    matrix[0]  = 1.0 - 2.0 * ( yy + zz );
    matrix[1]  = 2.0 * ( xy - zw );
    matrix[2]  = 2.0 * ( xz + yw );

    matrix[4]  = 2.0 * ( xy + zw );
    matrix[5]  = 1.0 - 2.0 * ( xx + zz );
    matrix[6]  = 2.0 * ( yz - xw );

    matrix[8]  = 2.0 * ( xz - yw );
    matrix[9]  = 2.0 * ( yz + xw );
    matrix[10] = 1.0 - 2.0 * ( xx + yy );

    matrix[3]  = matrix[7] = matrix[11] =
    matrix[12] = matrix[13] = matrix[14] = 0.0;
    matrix[15] = 1.0;

    return matrix;
}

function matrix_identity(matrix) {
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1.0;
    matrix[1] = matrix[2] = matrix[3] = matrix[4] = matrix[6] = matrix[7] = matrix[8] = 
    matrix[9] = matrix[11] = matrix[12] = matrix[13] = matrix[14] = 0.0; 
}

function matrix_translate(matrix, tx, ty, tz) {
    matrix[12] += ( matrix[0] * tx + matrix[4] * ty + matrix[ 8] * tz );
    matrix[13] += ( matrix[1] * tx + matrix[5] * ty + matrix[ 9] * tz );
    matrix[14] += ( matrix[2] * tx + matrix[6] * ty + matrix[10] * tz );
    matrix[15] += ( matrix[3] * tx + matrix[7] * ty + matrix[11] * tz );
}

function matrix_multiply(matrixA, matrixB) {
    var matrixResult = new Float32Array(16);
    var indexA;
	var i;
    for (i=0; i<4; i++) {
        indexA = i*4;
        matrixResult[indexA+0] = ( matrixA[indexA+0] * matrixB[ 0] ) +
                         ( matrixA[indexA+1] * matrixB[ 4] ) +
                         ( matrixA[indexA+2] * matrixB[ 8] ) +
                         ( matrixA[indexA+3] * matrixB[12] ) ;
        
        matrixResult[indexA+1] = ( matrixA[indexA+0] * matrixB[ 1] ) +
                         ( matrixA[indexA+1] * matrixB[ 5] ) +
                         ( matrixA[indexA+2] * matrixB[ 9] ) +
                         ( matrixA[indexA+3] * matrixB[13] ) ;
        
        matrixResult[indexA+2] = ( matrixA[indexA+0] * matrixB[ 2] ) +
                         ( matrixA[indexA+1] * matrixB[ 6] ) +
                         ( matrixA[indexA+2] * matrixB[10] ) +
                         ( matrixA[indexA+3] * matrixB[14] ) ;
        
        matrixResult[indexA+3] = ( matrixA[indexA+0] * matrixB[ 3] ) +
                         ( matrixA[indexA+1] * matrixB[ 7] ) +
                         ( matrixA[indexA+2] * matrixB[11] ) +
                         ( matrixA[indexA+3] * matrixB[15] ) ;
    }
    
    return matrixResult;
}

function matrix_frustum(left, right, bottom, top, near, far) {
    var deltaX = right - left;
    var deltaY = top - bottom;
    var deltaZ = far - near;
    var frust = new Float32Array(16);
    
    if ( ( near <= 0.0 ) || ( far <= 0.0 ) ||
        ( deltaX <= 0.0 ) || ( deltaY <= 0.0 ) || ( deltaZ <= 0.0 ) ) {    
        return null;
    }
    
    frust[ 0] = 2.0 * near / deltaX;
    frust[ 1] =  frust[ 2] =  frust[ 3] = 0.0;

    frust[ 5] = 2.0 * near / deltaY;
    frust[ 4] =  frust[ 6] =  frust[ 7] = 0.0;

    frust[ 8] = ( right + left ) / deltaX;
    frust[ 9] = ( top + bottom ) / deltaY;
    frust[10] = - ( near + far ) / deltaZ;
    frust[11] = -1.0;

    frust[14] = -2.0 * near * far / deltaZ;
    frust[12] =  frust[13] =  frust[15] = 0.0;
    
    return frust;
}

function matrix_perspective(fovy, aspect, near, far) {
    var frustumH = Math.tan ( fovy * 0.5 ) * near;
    var frustumW = frustumH * aspect;
    return matrix_frustum ( -frustumW, frustumW, -frustumH, frustumH, near, far );
}

function vec3f_cross(vec1, vec2){
    return new Float32Array([vec1[1]*vec2[2] - vec1[2]*vec2[1], vec1[2]*vec2[0] - vec1[0]*vec2[2], vec1[0]*vec2[1] - vec1[1]*vec2[0]]);
}

function vec3f_multiply(vec, d) {
    return new Float32Array([vec[0]*d, vec[1]*d, vec[2]*d]);
}

function vec3f_normal(vec) {
    var d = 1.0 / Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2]);
    return new Float32Array([vec[0]*d, vec[1]*d, vec[2]*d]);
}

function vec3f_add(vec1, vec2) {
    return new Float32Array([vec1[0]+vec2[0], vec1[1]+vec2[1], vec1[2]+vec2[2]]);
}

function vec3f_minus(vec1, vec2) {
    return new Float32Array([vec1[0]-vec2[0], vec1[1]-vec2[1], vec1[2]-vec2[2]]);
}

function matrix_look_at(pos, lookAt, up) {
    var axisX, axisY, axisZ;
    // axisZ = lookAt - pos
    axisZ = vec3f_minus(lookAt, pos);
    axisZ = vec3f_normal(axisZ);
    
    // axisX = up X axisZ
    axisX = vec3f_cross(up, axisZ);
    axisX = vec3f_normal(axisX);
    
    // axisY = axisZ x axisX
    axisY = vec3f_cross(axisZ, axisX);
    axisY = vec3f_normal(axisY);

    var matrix = new Float32Array(IDENTITY_MATRIX);
    matrix[ 0] = -axisX[0];
    matrix[ 1] =  axisY[0];
    matrix[ 2] = -axisZ[0];
    
    matrix[ 4] = -axisX[1];
    matrix[ 5] =  axisY[1];
    matrix[ 6] = -axisZ[1];
    
    matrix[ 8] = -axisX[2];
    matrix[ 9] =  axisY[2];
    matrix[10] = -axisZ[2];
    
    // translate (-posX, -posY, -posZ)
    matrix[12] =  axisX[0] * pos[0] + axisX[1] * pos[1] + axisX[2] * pos[2];
    matrix[13] = -axisY[0] * pos[0] - axisY[1] * pos[1] - axisY[2] * pos[2];
    matrix[14] =  axisZ[0] * pos[0] + axisZ[1] * pos[1] + axisZ[2] * pos[2];
    matrix[15] = 1.0;

    return matrix;
}

function do_display(x, y, w, h, need_clear, matrix) {    
    gl.viewport(x, y, w, h);
    if (need_clear)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(curr_program);
    gl.uniform1i(curr_loc_sampler, 0);
    if (matrix != null)
        gl.uniformMatrix4fv(loc_mvp, false, matrix);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, curr_vertex_buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, curr_index_buffer);

    if (curr_model == PLANAR_MODEL)
        gl.bufferData(gl.ARRAY_BUFFER, planar_vertex_data, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(curr_position_ptr);
    gl.enableVertexAttribArray(curr_texcoord_ptr);

    gl.vertexAttribPointer(curr_position_ptr, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(curr_texcoord_ptr, 2, gl.FLOAT, false, 20, 12);

    gl.drawElements(gl.TRIANGLES, curr_index_length, gl.UNSIGNED_SHORT, 0);

    gl.disableVertexAttribArray(curr_position_ptr);
    gl.disableVertexAttribArray(curr_texcoord_ptr);
}

function panoviewer_use_model(model_index) {
    curr_model = model_index;
    if (model_index == PLANAR_MODEL) {
        curr_program = planar_program;
        curr_position_ptr = planar_position_ptr;
        curr_texcoord_ptr = planar_texcoord_ptr;
        curr_vertex_buffer = planar_vertex_buffer;
        curr_index_buffer = planar_index_buffer;
        curr_loc_sampler = planar_loc_sampler;
        curr_index_length = planar_index_data.length;
    }else {
        curr_program = spheric_program;
        curr_position_ptr = spheric_position_ptr;
        curr_texcoord_ptr = spheric_texcoord_ptr;
        curr_vertex_buffer = spheric_vertex_buffer;
        curr_index_buffer = spheric_index_buffer;
        curr_loc_sampler = spheric_loc_sampler;
        curr_index_length = spheric_index_data.length;
    }
}

var offset_x = 0.0;
function panoviewer_update_offset(offx) {
    var middle;
    offset_x += offx;
    while (offset_x > 1.0) {
        offset_x -= 1.0;
    }
    while (offset_x < 0.0) {
        offset_x += 1.0;
    }
    
    if (offset_x > 0.0) {
        middle = 1.0 - offset_x;
    }
    else {
        middle = - offset_x;
    }
    planar_vertex_data[3] = middle;
    planar_vertex_data[8] = middle;
    planar_vertex_data[33] = middle;
    planar_vertex_data[38] = middle;
    planar_vertex_data[10] = (1.0 - middle) * 2.0 - 1.0;
    planar_vertex_data[15] = (1.0 - middle) * 2.0 - 1.0;
    planar_vertex_data[20] = (1.0 - middle) * 2.0 - 1.0;
    planar_vertex_data[25] = (1.0 - middle) * 2.0 - 1.0;
}

function panoviewer_update_quat(quat, fovy, distance) {
    var aspect = gl.canvas.width / gl.canvas.height;
    var right = new Float32Array(3);
    var pos_l = new Float32Array(3);
    var pos_r = new Float32Array(3);
    var look_at_l = new Float32Array(3);
    var look_at_r = new Float32Array(3);
    var mat_proj = new Float32Array(16);
    var mat_proj_small = new Float32Array(16);
    var mat_view_center = new Float32Array(16);
    var mat_view_left = new Float32Array(16);
    var mat_view_right = new Float32Array(16);
    var mat_model = new Float32Array(16);
    var mat_temp = new Float32Array(16);

    mat_model = quat_to_matrix(quat);

    matrix_identity(mat_temp);
    matrix_translate(mat_temp, 0.0, 0.0, distance);
    
    mat_model = matrix_multiply(mat_model, mat_temp);
    
    matrix_identity(mat_proj);
    mat_proj = matrix_perspective(fovy, aspect, 0.1, 100.0);
    
    matrix_identity(mat_proj_small);
    mat_proj_small = matrix_perspective(fovy, aspect*0.5, 0.1, 100.0);

    right       = vec3f_cross(AXIS_Z, AXIS_Y);
    right       = vec3f_multiply(right, 0.05*-0.5);
    pos_l       = vec3f_add(ORIGNAL, right);
    pos_r       = vec3f_minus(ORIGNAL, right);
    look_at_l   = vec3f_add(pos_l, AXIS_Z);
    look_at_r   = vec3f_add(pos_r, AXIS_Z);
    
    mat_view_center = matrix_look_at(ORIGNAL, AXIS_Z, AXIS_Y);
    mat_view_left = matrix_look_at(pos_l, look_at_l, AXIS_Y);
    mat_view_right = matrix_look_at(pos_r, look_at_r, AXIS_Y);
    
    mat_temp = matrix_multiply(mat_model, mat_view_center);
    mvp_center = matrix_multiply(mat_temp, mat_proj);
    
    mat_temp = matrix_multiply(mat_model, mat_view_left);
    mvp_left = matrix_multiply(mat_temp, mat_proj_small);
    
    mat_temp = matrix_multiply(mat_model, mat_view_right);
    mvp_right = matrix_multiply(mat_temp, mat_proj_small);
}

function panoviewer_set_default_model(default_model) {
    curr_model = default_model;
    if (curr_model < 0 || curr_model > FISHEYE_MODEL) {
        curr_model = PLANAR_MODEL;
    }
}

function panoviewer_need_binocular(binocular){
    BINOCULAR = binocular;
}

function panoviewer_get_current_model() {
    return curr_model;
}

function panoviewer_get_texture_source() {
    return texEle;
}

function panoviewer_start(pano_src, canvas_id, width, height) {
    // check input
    var isVideo = pano_src.lastIndexOf(".mp4") === pano_src.length - 4;
    var isImage = pano_src.lastIndexOf(".jpg") === pano_src.length - 4;
    if (!isVideo && !isImage)
        return;
	
    var canvas = document.getElementById(canvas_id);
	canvas.width = width;
	canvas.height = height;
    if (canvas === null)
        return;

	create_spheric_model(128, 128);

    // init webgl
    var gl_contextAttributes = { antialias:false };
    gl = null;
    for (var i=0; i<4; i++) {
        gl = canvas.getContext(["webgl","experimental-webgl","moz-webgl","webkit-3d"][i], gl_contextAttributes);
        if (gl) break;
    }
    if (!gl) {
        console.log("No WebGL support!");
        return;
    }
    console.log("WebGL init OK!!!");

    // prepare shaders & program
    var ps = gl.createShader(gl.FRAGMENT_SHADER);
    var planar_vs = gl.createShader(gl.VERTEX_SHADER);
    var spheric_vs = gl.createShader(gl.VERTEX_SHADER);

    // compile shaders
    gl.shaderSource(spheric_vs, spheric_vshader);
    gl.compileShader(spheric_vs);
    gl.shaderSource(planar_vs, planar_vshader);

    gl.compileShader(planar_vs);
    gl.shaderSource(ps, fshader);
    gl.compileShader(ps);

    // create program & buffers for planar model
    planar_program = gl.createProgram();
    gl.attachShader(planar_program, planar_vs);
    gl.attachShader(planar_program, ps);
    gl.linkProgram(planar_program);
    gl.useProgram(planar_program);

    planar_position_ptr = gl.getAttribLocation(planar_program, "in_position");
    planar_texcoord_ptr = gl.getAttribLocation(planar_program, "in_texcoord");
	gl.enableVertexAttribArray(planar_position_ptr);
	gl.enableVertexAttribArray(planar_texcoord_ptr);

    planar_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, planar_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, planar_vertex_data, gl.STATIC_DRAW);

    planar_index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planar_index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, planar_index_data, gl.STATIC_DRAW);

    gl.disableVertexAttribArray(planar_position_ptr);
    gl.disableVertexAttribArray(planar_texcoord_ptr);
    
    planar_loc_sampler = gl.getUniformLocation(planar_program, "sampler");

    // create program & buffers for shperic model
    spheric_program = gl.createProgram();
    gl.attachShader(spheric_program, spheric_vs);
    gl.attachShader(spheric_program, ps);
    gl.linkProgram(spheric_program);
    gl.useProgram(spheric_program);

    spheric_position_ptr = gl.getAttribLocation(spheric_program, "in_position");
    spheric_texcoord_ptr = gl.getAttribLocation(spheric_program, "in_texcoord");
	gl.enableVertexAttribArray(spheric_position_ptr);
	gl.enableVertexAttribArray(spheric_texcoord_ptr);

    spheric_vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spheric_vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, spheric_vertex_data, gl.STATIC_DRAW);

    spheric_index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spheric_index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, spheric_index_data, gl.STATIC_DRAW);

    gl.disableVertexAttribArray(spheric_position_ptr);
    gl.disableVertexAttribArray(spheric_texcoord_ptr);

    spheric_loc_sampler = gl.getUniformLocation(spheric_program, "sampler");
    loc_mvp = gl.getUniformLocation(spheric_program, "mvp");

    // create texture
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // iOS 10 bug workaround: add 'premultiplyAlpha' to avoid the buggy gpu-to-gpu code path
    // as the video doesn't have alpha, this is no visual effect
    //
    // related source:
    //  https://github.com/WebKit/webkit/blob/9abf87df6ed4f5b57e5770c993609962f6815625/Source/WebCore/platform/graphics/avfoundation/objc/MediaPlayerPrivateAVFoundationObjC.mm#L2534
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);


    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    var texture_ready = false;
    var needtouch = false;
    // iOS - start video via touch
    function iOS_video_touch_start() {
        console.log("got the touch, try playing");
        window.removeEventListener("touchstart", iOS_video_touch_start, true);
        // try to disable the iPhone video fullscreen mode:
        texEle.setAttribute("playsinline", "");
        texEle.setAttribute("webkit-playsinline", "");
        // try to disable the Android Weixin video fullscreen mode:
        texEle.setAttribute("x5-video-player-type", "h5");

        texEle.play();
        needtouch = false;
    }

    if (isVideo) {
        texEle = document.createElement("video");
        texEle.autoplay = true;
        texEle.loop = true;
        texEle.oncanplay = function() { 
            texture_ready=true; 
        };
        texEle.onerror = function() {
            console.log(texEle.src + " Error: " + texEle.error.code);
        };
        texEle.crossOrigin = "anonymous";
        texEle.src = pano_src;

        // try to disable the iPhone video fullscreen mode:
        texEle.setAttribute('crossorigin', 'anonymous');   
        texEle.setAttribute("playsinline", "");
        texEle.setAttribute("webkit-playsinline", "");
        // try to disable the Android Weixin video fullscreen mode:
        texEle.setAttribute("x5-video-player-type", "h5");

        // try to start playing
        video.load();
        texEle.play();
    }
    else if (isImage) {
        texEle = document.createElement("img");
        texEle.crossOrigin = "anonymous";
        texEle.src = pano_src;
        texEle.onload = function() { 
            texture_ready=true; 
        };
    }
    
    var gotTextureData = false;
    var errcnt=0;
    // requestAnimationFrame loop
    function frameloop() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        panoviewer_update_quat(quat, fovy, distance);
        if (isVideo && texEle.paused) {
            if (needtouch == false) {
                needtouch = true;
                console.log("Note - need a touch to start the video!");
                window.addEventListener("touchstart", iOS_video_touch_start, true);
            }
        }        
        panoviewer_use_model(curr_model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        if (texture_ready) {
			if (isImage) {
                // image only load once
                texture_ready = false;
            }

            try{
                // upload the video frame                
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texEle);
                gotTextureData = true;        
            }
            catch(e) {
                console.log(gl.getError());
                // log only the first few errors
                errcnt++;
                if (errcnt < 10)
                    console.log(e);
                else if (errcnt == 10)
                    console.log("...");
            }
        }


        if (gotTextureData) {  
            switch(curr_model) {
            case PLANAR_MODEL:			
					do_display(0, (gl.canvas.height - gl.canvas.width/2)/2, gl.canvas.width,gl.canvas.width/2, true, null);
                break;
            case LITTLE_PLANET_MODEL:
            case FISHEYE_MODEL:
            case SPHERIC_MODEL:
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.BACK);
                if (BINOCULAR) {
                    do_display(0, 0, gl.canvas.width/2, gl.canvas.height, true, mvp_left);
                    do_display(gl.canvas.width/2, 0, gl.canvas.width/2, gl.canvas.height, false, mvp_right);
                }else{
                    do_display(0, 0, gl.canvas.width, gl.canvas.height, true, mvp_center);
                }
                gl.disable(gl.CULL_FACE);
                break;
            default: break;
            }
        }

        window.requestAnimationFrame(frameloop);
    }

    frameloop();
}

function upixelsPanoViewer(canvas_id,src){
    initTouchAndMouse(canvas_id);
    panoviewer_need_binocular(false);
    panoviewer_start(src,canvas_id, document.documentElement.clientWidth, document.documentElement.clientHeight);
}
