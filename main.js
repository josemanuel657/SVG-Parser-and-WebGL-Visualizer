//  webgl and canvas variables
var canvas;
var gl;
var program;

// svg-file related variables
var svgDoc;
var lines;
var points;
var colors;


//initializes the variables needed to parse the svg file
var inputElement;
var input;
var file;
var reader;
var svgText;
var parser;
var viewBox;

// initializes value of modelMatrix-related variables
var scalingFactor = 1.0;
var angle = 0.0;
var xTranslation = 0.0;
var yTranslation = 0.0;

// initializes the value of the mouseDrag-related variables
var mouseDown = false;
var startX = 0.0;
var startY = 0.0;
var newX = 0.0;
var newY = 0.0;
var totalChangeX = 0.0;
var totalChangeY = 0.0;

/**
 * Receives input svg files to load them
 * establishes listeners for model changes in the loaded vertices
 */
function main() {
    setUpWebgl();
    inputElement = document.getElementById('files');
    inputElement.addEventListener('change', handleFileChange);
    document.addEventListener('keydown', makeReset);
    canvas.addEventListener('wheel', wheelEvents);
    canvas.addEventListener('mousedown',startDrag);
    canvas.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

/**
 * Reads the svg file, parses it, resets matrices-related variables to default, initializes those matrices,
 * cleans the canvas and draws the input svg file.
 * @param event
 */
function handleFileChange(event) {
    input = event;
    file = event.target.files[0];
    if (!file.name.endsWith('.svg')) {
        alert('The input must be a .svg file');
        return;
    }
    reader = readTextFile(event);
    reader.onload = function () {
        svgText = reader.result;
        parser = new DOMParser();
        svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        lines = xmlGetLines(svgDoc, '#000000');
        points = lines[0];
        colors = lines[1];
        setUpVerticesBuffers();
        setUpColorBuffers();
        setUpViewport();
        setUpProjectionMatrix();
        reset();
        setUpModelMatrix();
        gl.drawArrays(gl.LINES, 0, points.length);
    };
}

/**
 * initializes webgl variables and vector and fragment shaders
 */
function setUpWebgl() {
    canvas = document.getElementById('webgl');
    gl = WebGLUtils.setupWebGL(canvas, undefined);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    program = initShaders(gl, 'vshader', 'fshader');
    gl.useProgram(program);
}

/**
 * Establishes the viewport, depending on the dimensions of the svg file and whether the image is wider taller.
 * It does so in a way that the loaded file sits in the middle of the canvas.
 */
function setUpViewport() {
    viewBox = xmlGetViewbox(svgDoc, [0, 0, canvas.width, canvas.height]);
    if (viewBox[2] < viewBox[3]) {
        gl.viewport(0, 0, canvas.height * (viewBox[2] / viewBox[3]), canvas.height);
    } else {
        gl.viewport(0, 0, canvas.width, canvas.width * (viewBox[3] / viewBox[2]));
    }
}

/**
 * establishes an orthographic projection matrix
 */
function setUpProjectionMatrix() {
    const projectionMatrix = ortho(viewBox[0], viewBox[2] + viewBox[0], viewBox[1] + viewBox[3], viewBox[1]  , -1, 1);
    const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
    gl.uniformMatrix4fv(projectionMatrixLocation, false, flatten(projectionMatrix));
}

/**
 * establishes the vertices
 */
function setUpVerticesBuffers() {
    let vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    let vPosition = gl.getAttribLocation(program, 'vPosition');
    gl.enableVertexAttribArray(vPosition);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
}

/**
 * establishes the colors of the vertices.
 */
function setUpColorBuffers() {
    let cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    let vColor = gl.getAttribLocation(program, 'vColor');
    gl.enableVertexAttribArray(vColor);
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
}

/**
 * establishes the modelMatrix: rotateMatrix x translateMatrix x scaleMatrix
 */
function setUpModelMatrix(){
    let modelMatrix = getScaleMatrix();
    modelMatrix = mult(modelMatrix, getTranslateMatrix());
    modelMatrix = mult(modelMatrix, getRotateMatrix());
    let modelMatrixLocation = gl.getUniformLocation(program, "modelMatrix");
    gl.uniformMatrix4fv(modelMatrixLocation, false, flatten(modelMatrix));

}

/**
 * scales the image from its origin by:
 * 1) translating the vertices to the origin
 * 2) scaling the image scalingFactor units
 * 3) translating the vertices back
 * @returns {[]}
 */
function getScaleMatrix(){
    let first = translate((-viewBox[0] - viewBox[3])/2, (-viewBox[1] - viewBox[2])/2, 0);
    let second = scalem(scalingFactor, scalingFactor, scalingFactor);
    let third = translate((viewBox[0] + viewBox[3])/2, (+viewBox[1] + viewBox[2])/2, 0);
    return mult(mult(third,second), first);
}

/**
 * rotates the image around its origin by:
 * 1) translating the vertices to the origin
 * 2) rotating it angle degrees
 * 3) translating the vertices back
 * @returns {[]}
 */
function getRotateMatrix(){
    let first = translate((-viewBox[0] - viewBox[3])/2, (-viewBox[1] - viewBox[2])/2, 0);
    let second = rotateZ(angle);
    let third = translate((viewBox[0] + viewBox[3])/2, (+viewBox[1] + viewBox[2])/2, 0);
    return mult(mult(third,second), first);
}

/**
 * translates the image depending on the change in position of the drag
 * @returns {[]}
 */
function getTranslateMatrix(){
    return translate(totalChangeX, totalChangeY,0);
}

/**
 * sets the canvas background to white
 */
function clearCanvas() {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

/**
 * resets the all the model matrices related variables to their initial value,
 * cleans the canvas and redraws the current svg file.
 * @param event
 */
function makeReset(event){
    if(event.key.toLowerCase()==='r'){reset();}
}

/**
 * reset all the variables to put the image in the orignial position after being first loaded
 */
function reset(){
    angle = 0.0;
    scalingFactor = 1.0;
    xTranslation = 0.0;
    yTranslation = 0.0;
    startX = 0.0;
    startY = 0.0;
    newX = 0.0;
    newY = 0.0;
    totalChangeX = 0.0;
    totalChangeY = 0.0;
    setUpModelMatrix();
    clearCanvas();
    gl.drawArrays(gl.LINES, 0, points.length);
}

/**
 * depending on whether the user hold its key or not, it calls the scale or the rotate function respectively.
 * @param event
 */
function wheelEvents(event){
    if (event.shiftKey){
        scale(event);
    } else {
        rotate(event);
    }
    clearCanvas();
    gl.drawArrays(gl.LINES, 0, points.length);
    requestAnimationFrame(scale);
}

/**
 * scales the image to a max of 10x and a min of 0.10x when the users moves the mouse in the y
 * direction and the shift key is pressed
 * @param event
 */
function scale(event){
    if (event.deltaY > 0) {
        scalingFactor += 0.10;
    } else if (event.deltaY < 0) {
        scalingFactor -= 0.10;
    }
    if (scalingFactor < 0.1){
        scalingFactor = 0.1;
    }
    if (scalingFactor > 10.0){
        scalingFactor = 10.0;
    }
    setUpModelMatrix()
}

/**
 * Rotates the image around the Z-axis when the mouse moves up or down
 */
function rotate(event){
    if (event.deltaY > 0) {
        angle += 2.0;
    } else if (event.deltaY < 0) {
        angle -= 2.0;
    }
    setUpModelMatrix()
}

/**
 * triggers the drag
 * @param event
 */
function startDrag(event) {
    mouseDown = true;
    let coordinates = getMousePosition(event);
    startX = coordinates[0];
    startY = coordinates[1];
}

/**
 * drags the image by calculating the difference in position with respect
 * to the x and y canvas coordinates.
 * @param event
 */
function drag(event) {
    if (mouseDown){
    let coordinates = getMousePosition(event);

    let newX = coordinates[0] ;
    let newY = coordinates[1];

    let deltaX = newX - startX;
    let deltaY = newY - startY;

    totalChangeX += deltaX;
    totalChangeY += deltaY;

    startX = newX;
    startY = newY;

    setUpModelMatrix();
    gl.drawArrays(gl.LINES, 0, points.length);
    }
}

/**
 * stops the drag
 */
function stopDrag() {
    mouseDown = false;
}


/**
 * returns the position of the mouse with respect to the canvas.
 */
function getMousePosition(event){
    let mouseCanvasXCoordinate = event.offsetX;
    let mouseCanvasYCoordinate = event.offsetY;

    let worldWidth;
    let worldHeight;

    if (viewBox[2] < viewBox[3]) {
        worldWidth = canvas.height * (viewBox[2] / viewBox[3]);
        worldHeight = canvas.height;
    } else {
        worldWidth = canvas.width;
        worldHeight = canvas.width * (viewBox[3] / viewBox[2]);
    }

    let xPosition = worldWidth / (canvas.width) * mouseCanvasXCoordinate;
    let yPosition = (-worldHeight / (canvas.height)) * mouseCanvasYCoordinate + canvas.width*viewBox[3]/viewBox[2];
    let canvasX = xPosition * ( viewBox[2] / canvas.width) ;
    let canvasY = yPosition * ( -viewBox[3]  / canvas.height);

    return [canvasX, canvasY];
}
