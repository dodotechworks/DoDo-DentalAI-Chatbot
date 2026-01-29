
;(function () {
  /* ===========================
     SAFE SCRIPT DETECTION
  ============================ */
  const script =
    document.currentScript ||
    document.querySelector('script[data-bot-id]')

  const botId = script?.getAttribute("data-bot-id")

  if (!botId) {
    console.error("DODO Bot: Missing bot id")
    return
  }


  /* ===========================
     STYLES (PREMIUM GLASS UI)
  ============================ */
  const style = document.createElement("style")
  style.innerHTML = `
  :root {
    --glass-bg: rgba(255,255,255,0.78);
    --glass-border: rgba(255,255,255,0.35);
    --glass-blur: blur(18px);
  }

  #dodo-chat-button,
  #dodo-chat-box,
  #dodo-chat-box * {
    box-sizing: border-box;
    font-family: Inter, system-ui, -apple-system, Arial, sans-serif;
  }

  /* FLOATING BUTTON */
  #dodo-chat-button {
    position: fixed;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    cursor: pointer;
    background:
      linear-gradient(145deg, rgba(255,255,255,.35), rgba(255,255,255,.05)),
      var(--dodo-primary-color, #2563eb);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow:
      0 18px 40px rgba(0,0,0,.35),
      inset 0 1px 1px rgba(255,255,255,.5);
    transition: transform .25s ease, box-shadow .25s ease;
    z-index: 2147483647;
  }

  #dodo-chat-button:hover {
    transform: scale(1.1);
    box-shadow: 0 25px 60px rgba(0,0,0,.45);
  }

  /* CHAT BOX */
  #dodo-chat-box {
    position: fixed;
    width: 318px;
    height: 468px;
    display: none;
    flex-direction: column;
    border-radius: 22px;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: 0 35px 90px rgba(0,0,0,.45);
    overflow: hidden;
    z-index: 2147483647;
    transition: opacity .2s ease, transform .2s ease;
  }

  /* HEADER */
  #dodo-header {
    padding: 14px 16px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.25), rgba(255,255,255,.05)),
      linear-gradient(135deg, var(--dodo-primary-color,#2563eb), #1e3a8a);
    color: #fff;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }

  #dodo-header img {
    width: 28px;
    height: 28px;
    padding: 4px;
    border-radius: 50%;
    background: rgba(255,255,255,.9);
  }

  /* MESSAGES */
  #dodo-messages {
    flex: 1;
    padding: 14px;
    overflow-y: auto;
    background: linear-gradient(rgba(249,250,251,.7), rgba(243,244,246,.7));
    font-size: 14px;
  }

  .dodo-user,
  .dodo-bot,
  .dodo-typing {
    margin-bottom: 10px;
    animation: msg-in .25s ease;
  }

  @keyframes msg-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dodo-user { text-align: right; }

  .dodo-user span {
    max-width: 78%;
    display: inline-block;
    padding: 10px 12px;
    border-radius: 16px 16px 4px 16px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.25), rgba(255,255,255,.05)),
      var(--dodo-primary-color,#2563eb);
    color: #fff;
    box-shadow: 0 6px 18px rgba(0,0,0,.25);
  }

  .dodo-bot span {
    max-width: 78%;
    display: inline-block;
    padding: 10px 12px;
    border-radius: 16px 16px 16px 4px;
    background: rgba(255,255,255,.9);
    border: 1px solid rgba(0,0,0,.05);
    box-shadow: 0 4px 12px rgba(0,0,0,.15);
    color: #111827;
  }

  /* TYPING */
  .dodo-typing span {
    display: inline-flex;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 16px;
    background: rgba(255,255,255,.9);
    box-shadow: 0 4px 12px rgba(0,0,0,.15);
  }

  .dot {
    width: 6px;
    height: 6px;
    background: #9ca3af;
    border-radius: 50%;
    animation: blink 1.4s infinite both;
  }
  .dot:nth-child(2){animation-delay:.2s}
  .dot:nth-child(3){animation-delay:.4s}

  @keyframes blink {
    0%{opacity:.2}
    20%{opacity:1}
    100%{opacity:.2}
  }

  /* INPUT */
  #dodo-input {
    padding: 10px;
    display: flex;
    gap: 8px;
    background: rgba(255,255,255,.85);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-top: 1px solid rgba(0,0,0,.05);
  }

  #dodo-input input {
    flex: 1;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,.1);
    outline: none;
    background: rgba(255,255,255,.9);
  }

  #dodo-input button {
    padding: 10px 14px;
    border-radius: 12px;
    border: none;
    background: var(--dodo-primary-color,#2563eb);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(0,0,0,.25);
  }

  /* TIME PICKER */
  #dodo-time-picker {
    padding: 12px;
    background: rgba(255,255,255,.85);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-top: 1px solid rgba(0,0,0,.05);
  }

  #dodo-time-picker input,
  #dodo-time-picker button {
    width: 100%;
    margin-top: 6px;
    padding: 8px;
    border-radius: 10px;
  }
  `
  document.head.appendChild(style)

  /* ===========================
     BUTTON
  ============================ */
  const button = document.createElement("div")
  button.id = "dodo-chat-button"
  button.style.backgroundImage =
    "url('https://img.icons8.com/?size=100&id=AQdX4guXSINv&format=png&color=FFFFFF')"
  button.style.backgroundRepeat = "no-repeat"
  button.style.backgroundPosition = "center"
  button.style.backgroundSize = "60%"

  /* ===========================
     CHAT BOX
  ============================ */
  const box = document.createElement("div")
  box.id = "dodo-chat-box"
  box.innerHTML = `
    <div id="dodo-header">
      <img src="https://img.icons8.com/?size=100&id=AQdX4guXSINv&format=png&color=000000"/>
      <span>Dental Assistant</span>
    </div>
    <div id="dodo-messages"></div>
    <div id="dodo-input">
      <input placeholder="Type a message..." />
      <button>Send</button>
    </div>
    <div id="dodo-time-picker" style="display:none">
      <strong>Select appointment time</strong>
      <input type="date" id="dodo-date"/>
      <input type="time" id="dodo-time"/>
      <button id="dodo-confirm-time">Confirm</button>
    </div>
  `

  document.body.appendChild(button)
  document.body.appendChild(box)

  /* ===========================
     TOGGLE (SMOOTH)
  ============================ */
  button.onclick = () => {
    if (box.style.display === "flex") {
      box.style.opacity = "0"
      box.style.transform = "translateY(10px) scale(.96)"
      setTimeout(() => (box.style.display = "none"), 200)
    } else {
      box.style.display = "flex"
      requestAnimationFrame(() => {
        box.style.opacity = "1"
        box.style.transform = "translateY(0) scale(1)"
      })
    }
  }

  const messages = box.querySelector("#dodo-messages")
  const input = box.querySelector("input")
  const sendBtn = box.querySelector("button")
  const timePicker = box.querySelector("#dodo-time-picker")

  const addMessage = (text, type) => {
    const div = document.createElement("div")
    div.className = type
    div.innerHTML = `<span>${text}</span>`
    messages.appendChild(div)
    messages.scrollTop = messages.scrollHeight
  }

  const showTyping = () => {
    if (document.getElementById("dodo-typing")) return
    const div = document.createElement("div")
    div.className = "dodo-typing"
    div.id = "dodo-typing"
    div.innerHTML = `
      <span>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </span>`
    messages.appendChild(div)
    messages.scrollTop = messages.scrollHeight
  }

  const hideTyping = () => {
    const t = document.getElementById("dodo-typing")
    if (t) t.remove()
  }

  /* ===========================
     BRANDING
  ============================ */
const applyPosition = (pos = "bottom-right") => {
  // RESET ALL FIRST
  const reset = {
    top: "auto",
    right: "auto",
    bottom: "auto",
    left: "auto"
  }

  Object.assign(button.style, reset)
  Object.assign(box.style, reset)

  switch (pos) {
    case "bottom-left":
      button.style.bottom = "20px"
      button.style.left = "20px"

      box.style.bottom = "92px"
      box.style.left = "20px"
      break

    case "top-right":
      button.style.top = "20px"
      button.style.right = "20px"

      box.style.top = "92px"
      box.style.right = "20px"
      break

    case "top-left":
      button.style.top = "20px"
      button.style.left = "20px"

      box.style.top = "92px"
      box.style.left = "20px"
      break

    case "bottom-right":
    default:
      button.style.bottom = "20px"
      button.style.right = "20px"

      box.style.bottom = "92px"
      box.style.right = "20px"
  }
}

  fetch(`https://dodo-dentalai-chatbot.onrender.com/api/widget/${botId}`)
    .then(r => r.json())
    .then(d => {
      document.documentElement.style.setProperty(
        "--dodo-primary-color",
        d.primary_color || "#2563eb"
      )

      const botName = d.display_name || "Dental Assistant"
      box.querySelector("#dodo-header span").innerText = botName

      applyPosition(d.widget_position)

      // ✅ SHOW WELCOME
      showWelcome(botName)
    })
    .catch(() => {})


  /* ===========================
    WELCOME MESSAGE (ONCE)
  ============================ */
  let welcomed = false

  const showWelcome = (name) => {
    if (welcomed) return
    welcomed = true

    addMessage(
      `👋 Hi! I’m the virtual assistant for ${name}.
  How can I help you today?`,
      "dodo-bot"
    )
  }

  /* ===========================
     SEND MESSAGE
  ============================ */
  const sessionId =
    localStorage.getItem("dodo_session_id") ||
    (() => {
      const id = crypto.randomUUID()
      localStorage.setItem("dodo_session_id", id)
      return id
    })()

  const sendMessage = async text => {
    addMessage(text, "dodo-user")
    showTyping()

    let data = {}
    try {
      const res = await fetch("https://dodo-dentalai-chatbot.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, message: text, sessionId })
      })
      data = await res.json()
    } catch (e) {}

    hideTyping()
    addMessage(data.reply || "Something went wrong", "dodo-bot")

    if (
      data.reply &&
      data.reply.toLowerCase().includes("preferred") &&
      data.reply.toLowerCase().includes("time")
    ){
      document.getElementById("dodo-input").style.display = "none"
      timePicker.style.display = "block"
    }
  }

  sendBtn.onclick = () => {
    if (!input.value.trim()) return
    sendMessage(input.value.trim())
    input.value = ""
  }

  document.getElementById("dodo-confirm-time").onclick = () => {
    const d = document.getElementById("dodo-date").value
    const t = document.getElementById("dodo-time").value

    if (!d || !t) {
      addMessage("Please select both date and time 😊", "dodo-bot")
      return
    }

    timePicker.style.display = "none"
    document.getElementById("dodo-input").style.display = "flex"
    sendMessage(`${d} at ${t}`)
  }
})()