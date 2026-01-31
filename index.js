<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>WoW 3D Character Studio</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <style>
        :root { --panel-bg: rgba(25, 25, 25, 0.95); --accent: #ffd100; --border: #444; }
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #0a0a0a; color: #eee; font-family: 'Inter', sans-serif; overflow: hidden; }

        /* UI Overlay */
        #ui-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }
        .panel { pointer-events: auto; position: absolute; background: var(--panel-bg); border: 1px solid var(--border); padding: 12px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .outliner { top: 20px; left: 20px; width: 220px; }
        .properties { top: 20px; right: 20px; width: 240px; }
        .status-bar { bottom: 20px; left: 20px; right: 20px; height: 35px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }

        h4 { margin: 0 0 10px; color: var(--accent); font-size: 10px; border-bottom: 1px solid var(--border); padding-bottom: 5px; }
        input { width: 100%; background: #000; border: 1px solid #444; color: white; padding: 8px; margin-bottom: 8px; box-sizing: border-box; outline: none; }
        input:focus { border-color: var(--accent); }
        
        button { width: 100%; background: #333; border: 1px solid #555; color: white; padding: 10px; cursor: pointer; margin-top: 5px; font-weight: bold; transition: 0.2s; font-size: 10px; }
        button:hover { background: var(--accent); color: black; }
        
        label { display: block; margin: 12px 0 5px; color: #888; font-size: 9px; }
        input[type="range"] { width: 100%; accent-color: var(--accent); cursor: pointer; }

        /* Render Viewport */
        #render-target { width: 100vw; height: 100vh; cursor: grab; background: radial-gradient(circle, #1a1a1a 0%, #050505 100%); }
        #render-target:active { cursor: grabbing; }

        .helper-text { margin-top: 15px; color: #555; font-size: 9px; line-height: 1.4; text-transform: none; }
    </style>
</head>
<body>

<div id="ui-container">
    <div class="panel outliner">
        <h4>Character Fetch</h4>
        <input type="text" id="name" placeholder="NAME (e.g. Leeroy)">
        <input type="text" id="realm" placeholder="REALM (e.g. Ragnaros)">
        <button onclick="fetchAndRender()">LOAD 3D OBJECT</button>
        
        <div class="helper-text">
            <b>VIEWPORT CONTROLS:</b><br>
            • Orbit: Left Click + Drag<br>
            • Zoom: Mouse Wheel<br>
            • Pan: Right Click + Drag
        </div>
    </div>

    <div class="panel properties">
        <h4>3D Transform</h4>
        <label>Rotation Y (Auto Spin)</label>
        <input type="range" id="rotY" min="-3.14" max="3.14" step="0.01" value="0">
        
        <label>Vertical Tilt</label>
        <input type="range" id="rotX" min="-0.8" max="0.8" step="0.01" value="0">

        <label>Object Scale</label>
        <input type="range" id="objScale" min="0.1" max="2" step="0.05" value="1" oninput="updateScale()">
        
        <h4 style="margin-top:25px;">Export</h4>
        <button style="background:#28a745; border:none; color:white;" onclick="downloadSnapshot()">DOWNLOAD ALPHA .PNG</button>
        <button onclick="resetView()">RESET CAMERA</button>
    </div>

    <div class="panel status-bar">
        <div id="status">STATUS: ENGINE_READY</div>
        <div id="char-display" style="color:var(--accent); font-weight: bold;">NO CHARACTER LOADED</div>
        <div style="color:#555">FPS: 60</div>
    </div>
</div>

<div id="render-target"></div>

<script>
    let scene, camera, renderer, charObject;
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    
    // REPLACE THIS with your actual worker URL
    const WORKER_BASE = "https://my-worker.whazorz.workers.dev";

    function init() {
        // 1. Scene Setup
        scene = new THREE.Scene();
        
        // 2. Camera Setup
        camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 6);

        // 3. Renderer Setup
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true, 
            preserveDrawingBuffer: true // Required for PNG export
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('render-target').appendChild(renderer.domElement);

        // 4. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        // 5. Floor Grid
        const grid = new THREE.GridHelper(10, 20, 0x333333, 0x111111);
        grid.position.y = -2;
        scene.add(grid);

        window.addEventListener('resize', onWindowResize);
        animate();
    }

    async function fetchAndRender() {
        const nameInput = document.getElementById('name').value.trim();
        const realmInput = document.getElementById('realm').value.trim();
        const status = document.getElementById('status');

        if(!nameInput || !realmInput) return alert("Please enter Name and Realm");

        status.innerText = "STATUS: FETCHING DATA...";

        try {
            // Step A: Get Metadata from Worker
            const apiUrl = `${WORKER_BASE}/?name=${encodeURIComponent(nameInput)}&realm=${encodeURIComponent(realmInput)}&region=eu`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Step B: Resolve Image Path
            const assets = data.media.assets;
            const originalImgUrl = assets.find(a => a.key === "main-raw")?.value || assets[0].value;

            // Step C: Load via Proxy to fix CORS
            const proxiedUrl = `${WORKER_BASE}/?proxyUrl=${encodeURIComponent(originalImgUrl)}`;
            
            status.innerText = "STATUS: PROCESSING 3D TEXTURE...";

            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin("anonymous");
            
            loader.load(proxiedUrl, (texture) => {
                create3DPlane(texture);
                status.innerText = "STATUS: RENDER_READY";
                document.getElementById('char-display').innerText = `${nameInput.toUpperCase()} @ ${realmInput.toUpperCase()}`;
            });

        } catch (err) {
            status.innerText = "STATUS: ERROR - CHECK CONSOLE";
            console.error("Fetch Error:", err);
        }
    }

    function create3DPlane(texture) {
        if (charObject) scene.remove(charObject);

        // Setup Texture Rendering
        texture.minFilter = THREE.LinearFilter;
        const aspect = texture.image.width / texture.image.height;
        
        const geometry = new THREE.PlaneGeometry(4 * aspect, 4);
        const material = new THREE.MeshStandardMaterial({ 
            map: texture, 
            transparent: true, 
            side: THREE.DoubleSide,
            alphaTest: 0.1 // Prevents faint boxes around character
        });

        charObject = new THREE.Mesh(geometry, material);
        charObject.position.y = 0.2; // Slight lift off grid
        scene.add(charObject);
        
        // Match sliders to initial object state
        document.getElementById('rotY').value = 0;
        document.getElementById('rotX').value = 0;
    }

    // --- INTERACTION LOGIC ---

    const viewport = document.getElementById('render-target');
    
    viewport.addEventListener('mousedown', (e) => { if(e.button === 0) isDragging = true; });
    window.addEventListener('mouseup', () => isDragging = false);
    
    window.addEventListener('mousemove', (e) => {
        if (isDragging && charObject) {
            charObject.rotation.y += (e.clientX - prevMouse.x) * 0.01;
            charObject.rotation.x += (e.clientY - prevMouse.y) * 0.01;
            
            // Sync sliders
            document.getElementById('rotY').value = charObject.rotation.y;
            document.getElementById('rotX').value = charObject.rotation.x;
        }
        prevMouse = { x: e.clientX, y: e.clientY };
    });

    // Zoom control
    window.addEventListener('wheel', (e) => {
        camera.position.z += e.deltaY * 0.005;
        camera.position.z = Math.max(2, Math.min(camera.position.z, 15));
    });

    // Manual slider updates
    document.getElementById('rotY').addEventListener('input', (e) => {
        if(charObject) charObject.rotation.y = parseFloat(e.target.value);
    });
    document.getElementById('rotX').addEventListener('input', (e) => {
        if(charObject) charObject.rotation.x = parseFloat(e.target.value);
    });

    function updateScale() {
        if(charObject) {
            const s = document.getElementById('objScale').value;
            charObject.scale.set(s, s, s);
        }
    }

    function resetView() {
        if(charObject) charObject.rotation.set(0,0,0);
        camera.position.set(0, 0, 6);
    }

    function downloadSnapshot() {
        const link = document.createElement('a');
        link.download = 'wow-3d-capture.png';
        link.href = renderer.domElement.toDataURL("image/png");
        link.click();
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    init();
</script>

</body>
</html>