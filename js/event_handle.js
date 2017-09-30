var isUserInteracting;
var startX, startY;
var lastX, lastY;
var quat = new Float32Array([0.0, 0.0, 0.0, 1.0]);
var fovy = 1.7;
var distance = 0.0;
var yaw = 0.0;
var pitch = 0.0;
var orientaion = "portrait";

var MAX_FOVY = 2.0;
var MIN_FOVY = 1.0;
var MAX_DISTANCE = 2.0;
var MIN_DISTANCE = 0.0;

var canvas;
var touchQuat = new Float32Array([0.0, 0.0, 0.0, 1.0]);
var gyroQuat =  new Float32Array([0.0, 0.0, 0.0, 1.0]);

function quat4f_rotate(quat1, quat2)
{
    var quat0 = new Float32Array(4);

    quat0[0] = quat2[3]*quat1[0] + quat2[0]*quat1[3] + quat2[1]*quat1[2] - quat2[2]*quat1[1];
    quat0[1] = quat2[3]*quat1[1] - quat2[0]*quat1[2] + quat2[1]*quat1[3] + quat2[2]*quat1[0];
    quat0[2] = quat2[3]*quat1[2] + quat2[0]*quat1[1] - quat2[1]*quat1[0] + quat2[2]*quat1[3];
    quat0[3] = quat2[3]*quat1[3] - quat2[0]*quat1[0] - quat2[1]*quat1[1] - quat2[2]*quat1[2];
    return quat0;
}

function quat_from_eular(yaw, pitch, roll)
{
    var fCosHRoll = Math.cos(roll * 0.5);
    var fSinHRoll = Math.sin(roll * 0.5);
    var fCosHPitch = Math.cos(pitch * 0.5);
    var fSinHPitch = Math.sin(pitch * 0.5);
    var fCosHYaw = Math.cos(yaw * 0.5);
    var fSinHYaw = Math.sin(yaw * 0.5);
    
    var q = new Float32Array(4);
    q[0] = fCosHRoll * fSinHPitch * fCosHYaw + fSinHRoll * fCosHPitch * fSinHYaw;
    q[1] = fCosHRoll * fCosHPitch * fSinHYaw - fSinHRoll * fSinHPitch * fCosHYaw;
    q[2] = fSinHRoll * fCosHPitch * fCosHYaw - fCosHRoll * fSinHPitch * fSinHYaw;
    q[3] = fCosHRoll * fCosHPitch * fCosHYaw + fSinHRoll * fSinHPitch * fSinHYaw;
    return q;
}

function orientationChangeHandler(){
    switch(window.orientation){
        case 0:
        case 180:
            orientaion = "portrait";
            break;
        case 90:
            orientaion = "landeScapeRight";
        break;
        case -90:
            orientaion = "landeScapeLeft";
        break;
        default:
        break;
    }
}

var degtorad = Math.PI / 180;
function handleOrientation(event) {
	if(isUserInteracting == true ) return;

    var alpha = event.alpha; //roll    y
    var beta = event.beta; //pitch    x
    var gamma = event.gamma; //yaw   z
    
    var _x = beta  ? beta  * degtorad : 0; 
    var _y = gamma ? gamma * degtorad : 0;
    var _z = alpha ? alpha * degtorad : 0;

    var cX = Math.cos( _x/2 );
    var cY = Math.cos( _y/2 );
    var cZ = Math.cos( _z/2 );
    var sX = Math.sin( _x/2 );
    var sY = Math.sin( _y/2 );
    var sZ = Math.sin( _z/2 );
    
    var quat_0 = new Float32Array(4);
    if(orientaion == "portrait"){
        quat_0[3] = cX * cY * cZ - sX * sY * sZ;    //w
        quat_0[0] = (sX * cY * cZ - cX * sY * sZ);  //x
        quat_0[1] = -(cX * sY * cZ + sX * cY * sZ); //y
        quat_0[2] = -(cX * cY * sZ + sX * sY * cZ); //z
    }else if(orientaion == "landeScapeRight"){
        quat_0[3] = cX * cY * cZ - sX * sY * sZ;    //w
        quat_0[1] = -(sX * cY * cZ - cX * sY * sZ); //x
        quat_0[0] = -(cX * sY * cZ + sX * cY * sZ); //y
        quat_0[2] = -(cX * cY * sZ + sX * sY * cZ); //z
    }else if(orientaion == "landeScapeLeft"){
        quat_0[3] = cX * cY * cZ - sX * sY * sZ;    //w
        quat_0[1] = (sX * cY * cZ - cX * sY * sZ);  //x
        quat_0[0] = (cX * sY * cZ + sX * cY * sZ);  //y
        quat_0[2] = -(cX * cY * sZ + sX * sY * cZ);
    }
    // var quat_1 = quat_from_eular(-0.5*Math.PI, -0.5*Math.PI, Math.PI*0.5);
    // gyroQuat = quat4f_rotate(quat_0, quat_1);
    // quat = quat4f_rotate(gyroQuat, touchQuat);
    // panoviewer_update_quat(quat, fovy, distance);
}

// 对于mouseWheel事件在各个浏览器中存在浏览器兼容性问题。
// Firefox：DOMMouseScroll    (detail判断上下滑动)             
// IE/Chrome/Safari/Opera：mousewheel  (wheelDelta判断鼠标上下滑动)
// 这里只兼容IE/Chrome/Safari/Opera
function onDocumentMouseWheel( event ) {
	event.preventDefault();
    if (panoviewer_get_current_model() == PLANAR_MODEL)
        return;

    if (event.type == 'DOMMouseScroll' || event.type == 'wheel') {
        event.delta = (event.wheelDelta) ? event.wheelDelta / 120 : -(event.detail || 0) / 3;
    }
    var delta = -event.delta;
    if (delta > 0) {
        if (fovy < MAX_FOVY) {
            fovy += delta / 10;
            if (fovy > MAX_FOVY)
                fovy = MAX_FOVY;
        }else if (distance < MAX_DISTANCE) {
            distance += delta / 10;
            if (distance > MAX_DISTANCE)
                distance = MAX_DISTANCE;
        }
    }
    else {
        if (distance > MIN_DISTANCE) {
            distance += delta / 10;
            if (distance < MIN_DISTANCE)
                distance = MIN_DISTANCE;
        }
        else if (fovy > MIN_FOVY) {
            fovy += delta / 10;
            if (fovy < MIN_FOVY)
                fovy = MIN_FOVY;
        }
    }
    panoviewer_update_quat(quat, fovy, distance);
}

function onDocumentMouseDown( event ) {
    event.preventDefault();
    isUserInteracting = true;
    startX = event.clientX;
    startY = event.clientY;
    lastX = startX;
    lastY = startY;
}

function onDocumentMouseMove( event ) {
    if ( isUserInteracting === true ) {
        if (panoviewer_get_current_model() == 0) {
            panoviewer_update_offset((event.clientX - lastX) / canvas.width);
        }
        else {
            var focus = (canvas.height * 0.5) / Math.tan(fovy*0.5);
            var deltaYaw = Math.atan2(event.clientX - lastX, focus);
            var deltaPitch = Math.atan2(event.clientY - lastY, focus);
	
            yaw -= deltaYaw;
            pitch += deltaPitch;
            
            if (pitch > 1.57) pitch = 1.57;
            if (pitch < -1.57) pitch = -1.57;

            touchQuat = quat_from_eular(yaw, pitch, 0);
            quat = quat4f_rotate(gyroQuat, touchQuat);
            panoviewer_update_quat(quat, fovy, distance);
        }

        lastX = event.clientX;
        lastY = event.clientY;
    }
}

function onDocumentMouseUp( event ) {
    isUserInteracting = false;
}

var dis = {};
var origin;
var scale = 1;
var isCanScale = false;
var tmp_distance = 1.0;
function touchHandler(e){
	e.preventDefault();
	var touchCount = e.touches.length;

	switch(e.type){
		case 'touchstart':
            isUserInteracting = true;
			if (e.touches.length > 1) {

				dis.start = getDistance({
								x: e.touches[0].screenX,
								y: e.touches[0].screenY
							}, {
								x: e.touches[1].screenX,
								y: e.touches[1].screenY
							});
			}else{
				startX = e.touches[0].clientX;
				startY = e.touches[0].clientY;
				lastX = startX;
				lastY = startY;
			}
			break;

		case 'touchmove':
			if (e.touches.length == 2) {
				origin = getOrigin({
							x: e.touches[0].pageX,
							y: e.touches[0].pageY
						}, {
							x: e.touches[1].pageX,
							y: e.touches[1].pageY
						});
				dis.stop = getDistance({
							x: e.touches[0].screenX,
							y: e.touches[0].screenY
						}, {
							x: e.touches[1].screenX,
							y: e.touches[1].screenY
						});
				scale = dis.stop / dis.start;
                
                distance += (1-scale)/5;
                fovy += (1-scale)/5;
                if (fovy > MAX_FOVY) 
                    fovy = MAX_FOVY;
                else if(fovy < MIN_FOVY){
                    fovy = MIN_FOVY;
                }
                if (distance>MAX_DISTANCE)
                    distance = MAX_DISTANCE;
                else if(distance<MIN_DISTANCE)
                    distance = MIN_DISTANCE;
				panoviewer_update_quat(quat,fovy,distance);

				isCanScale = true;
			}else{
				if ( isUserInteracting == true ) {
					if (panoviewer_get_current_model() == 0) {
						panoviewer_update_offset((e.touches[0].clientX - lastX) / canvas.width);
					}
					else {
						var focus = (canvas.height * 0.5) / Math.tan(fovy*0.5);
						var deltaYaw = Math.atan2(e.touches[0].clientX - lastX, focus);
						var deltaPitch = Math.atan2(e.touches[0].clientY - lastY, focus);

						yaw -= deltaYaw;
						pitch += deltaPitch;

						if (pitch > 1.57) pitch = 1.57;
						if (pitch < -1.57) pitch = -1.57;

						touchQuat = quat_from_eular(yaw, pitch, 0);
						quat = quat4f_rotate(gyroQuat, touchQuat);
						panoviewer_update_quat(quat, fovy, distance);
					}

					lastX = e.touches[0].clientX;
					lastY = e.touches[0].clientY;
				}
			}
			break;

		case 'touchend':
			if(isCanScale){
				scale = 1.0;
                isCanScale = false;
                panoviewer_update_quat(quat, fovy, distance);
			}else{
                // delayScroll(e.touches[0], -0.001, 20);
            }
			isUserInteracting = false;
			break;

		default:;
	}

	function getOrigin(first, second) {
		return {
		x: (first.x + second.x) / 2,
		y: (first.y + second.y) / 2
		};
	}
	function getDistance(start, stop) {
		return Math.sqrt(Math.pow((stop.x - start.x), 2) + Math.pow((stop.y - start.y), 2));
	}
}

function updateModel(model){
    panoviewer_set_default_model(model);
    if (panoviewer_get_current_model() == 0) {
        distance = 0.0;
        fovy = MIN_DISTANCE;
    }else if (panoviewer_get_current_model() == 1) {
        distance = 0.0;
        MAX_DISTANCE = 2.0;
        MIN_DISTANCE = 0.0;
        fovy = 1.7;
    }else if (panoviewer_get_current_model() == 2) {
        distance = 1.0;
        MAX_DISTANCE = 1.0;
        MIN_DISTANCE = 0.0;
        fovy = 2.0;
        console.log(fovy);
    }else if (panoviewer_get_current_model() == 3) {
        distance = 2.0;
        MAX_DISTANCE = 2.0;
        MIN_DISTANCE = 1.0;
        fovy = 2.0;
    }
    panoviewer_update_quat(quat, fovy, distance);
}

function initTouchAndMouse(canvas_id) {
    canvas = document.getElementById(canvas_id);
    if (canvas == null)
        return;

    canvas.addEventListener( 'mousedown', onDocumentMouseDown, false );
    canvas.addEventListener( 'mousemove', onDocumentMouseMove, false );
    canvas.addEventListener( 'mouseup', onDocumentMouseUp, false );
    if (navigator.userAgent.indexOf('Firefox') >= 0){
        canvas.addEventListener( 'DOMMouseScroll', onDocumentMouseWheel, false );
    }else{
        canvas.addEventListener( 'wheel', onDocumentMouseWheel, false );
    }
    canvas.addEventListener( 'mouseleav', onDocumentMouseUp, false);
    canvas.addEventListener("touchstart", touchHandler, true);
    canvas.addEventListener("touchmove", touchHandler, true);
    canvas.addEventListener("touchend", touchHandler, true);
    canvas.addEventListener("touchcancel", touchHandler, true);

    window.addEventListener('deviceorientation',handleOrientation);
    window.addEventListener("onorientationchange" in window ? "orientationchange" : "resize", orientationChangeHandler, false);
}
