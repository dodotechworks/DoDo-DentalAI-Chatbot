// force git refresh
import express from "express"
import cors from "cors"
import supabase from "./supabase.js"
import { askOpenAI } from "./openai.js"
import path from "path"
import { fileURLToPath } from "url"
import { sendLeadEmail } from "./email.js"
import { DateTime } from "luxon"
import crypto from "crypto"


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* =========================
   PLAN CONFIG
========================= */
const PLAN_LIMITS = {
  free: { monthly_limit: 30, max_bots: 1, white_label: false },
  starter: { monthly_limit: 3000, max_bots: 1, white_label: true },
  pro: { monthly_limit: 50000, max_bots: 5, white_label: true }
}

const leadSessions = {}

function isAppointmentIntent(message) {
  return [
    "appointment",
    "book",
    "booking",
    "schedule",
    "consultation",
    "visit",
    "checkup"
  ].some(word => message.toLowerCase().includes(word))
}

app.use("/widget", express.static(path.join(__dirname, "public")))
app.use(cors())
app.use(
  "/api/paddle/webhook",
  express.raw({ type: "application/json" })
)
app.use(express.json())

/* =========================
   HEALTH
========================= */
app.get("/", (_, res) => {
  res.send("AI Bot Server Running 🚀")
})

/* =========================
   Email Validation Functions
========================= */
function isValidName(name) {
  return /^[a-zA-Z\s]{2,}$/.test(name)
}

function isValidPhone(phone) {
  return /^[0-9]{7,15}$/.test(phone)
}

function isValidEmail(email) {
  if (!email) return true // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}


function verifyPaddleSignature(req) {
  const signature = req.headers["paddle-signature"]
  const body = req.body

  if (!signature) return false

  const hmac = crypto.createHmac(
    "sha256",
    process.env.PADDLE_WEBHOOK_SECRET
  )

  hmac.update(body)
  const digest = hmac.digest("hex")

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  )
}
/* =========================
   SYNC CLERK USER
========================= */
app.post("/api/sync-user", async (req, res) => {
  const { clerkId, email } = req.body
  if (!clerkId) return res.status(400).json({ error: "Missing clerkId" })

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single()

  if (existingUser) return res.json(existingUser)

  const now = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 30)

  const { data, error } = await supabase
    .from("users")
    .insert({
      clerk_id: clerkId,
      email,
      plan: "free",
      monthly_limit: PLAN_LIMITS.free.monthly_limit,
      used_this_cycle: 0,
      billing_start_at: now,
      billing_end_at: end,
      subscription_status: "active"
    })
    .select()
    .single()

  if (error) return res.status(500).json(error)
  res.json(data)
})

/* =========================
   CREATE BOT
========================= */
app.post("/api/bots", async (req, res) => {
  const {
    userId,
    name,
    systemPromptLocked,
    systemPromptCustom
  } = req.body

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single()

  if (userError) {
    console.error("USER FETCH ERROR:", userError)
    return res.status(500).json({ error: "User fetch failed" })
  }

  const { count, error: countError } = await supabase
    .from("bots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  if (countError) {
    console.error("COUNT ERROR:", countError)
    return res.status(500).json({ error: "Bot count failed" })
  }

  if (count >= PLAN_LIMITS[user.plan].max_bots) {
    return res.status(403).json({ error: "Bot limit reached" })
  }

  const { data, error } = await supabase
    .from("bots")
    .insert({
      user_id: userId,
      name,
      system_prompt_locked: systemPromptLocked,
      system_prompt_custom: systemPromptCustom
    })
    .select()
    .single()

  if (error) {
    console.error("INSERT ERROR:", error) // 👈 THIS IS KEY
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

/* =========================
   GET USER BOTS
========================= */
app.get("/api/users/:userId/bots", async (req, res) => {
  const { data, error } = await supabase
    .from("bots")
    .select("*")
    .eq("user_id", req.params.userId)
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json(error)
  res.json(data)
})

app.get("/api/bots/:botId/prompt", async (req, res) => {
  const { data, error } = await supabase
    .from("bots")
    .select("system_prompt_custom")
    .eq("id", req.params.botId)
    .single()

  if (error) return res.status(404).json({ error: "Bot not found" })
  res.json(data)
})

app.put("/api/bots/:botId/prompt", async (req, res) => {
  const { systemPromptCustom } = req.body

  if (!systemPromptCustom) {
    return res.status(400).json({ error: "Prompt required" })
  }

  const { error } = await supabase
    .from("bots")
    .update({ system_prompt_custom: systemPromptCustom })
    .eq("id", req.params.botId)

  if (error) return res.status(500).json(error)
  res.json({ success: true })
})


/* =========================
   CHAT + APPOINTMENT FLOW
========================= */

const CLINIC_TIMEZONE = "America/New_York"

function convertPreferredTimeToUTC(preferred_time) {
  // Expected format: "2026-01-27 at 12:43"
  const parsed = DateTime.fromFormat(
    preferred_time,
    "yyyy-MM-dd 'at' HH:mm",
    { zone: CLINIC_TIMEZONE }
  )

  if (!parsed.isValid) return null

  return parsed.toUTC().toISO()
}

app.post("/api/chat", async (req, res) => {
  try {
    const { botId, message } = req.body
    if (!botId || !message) {
      return res.status(400).json({ error: "Missing botId or message" })
    }

    /* ===== Load bot + user ===== */
    const { data: bot } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single()

    if (!bot) return res.status(404).json({ error: "Bot not found" })

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", bot.user_id)
      .single()

    if (!user) return res.status(404).json({ error: "User not found" })

    /* ===== Billing checks ===== */
    const now = new Date()
    if (now > new Date(user.billing_end_at)) {
      return res.status(402).json({
        error: "Subscription expired"
      })
    }

    if (user.used_this_cycle >= user.monthly_limit) {
      return res.status(429).json({
        error: "Usage limit reached"
      })
    }
    /* ===== Appointment session ===== */
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" })
    }

    const key = `${botId}-${sessionId}`
    const session = leadSessions[key]

    const text = message.trim()

    /* ===== ACTIVE APPOINTMENT FLOW ===== */
    if (session) {
      /* --- NAME --- */
      if (session.step === "name") {
        if (!isValidName(text)) {
          return res.json({
            reply: "Please enter a valid full name (letters only)."
          })
        }

        session.data.name = text
        session.step = "phone"
        return res.json({ reply: "Thanks! May I have your phone number?" })
      }

      /* --- PHONE --- */
      if (session.step === "phone") {
        if (!isValidPhone(text)) {
          return res.json({
            reply: "Please enter a valid phone number (digits only)."
          })
        }

        session.data.phone = text
        session.step = "email"
        return res.json({
          reply: "What is your email address?"
        })
      }

      /* --- EMAIL --- */
      if (session.step === "email") {
        if (!isValidEmail(text)) {
          return res.json({
            reply: "Please enter a valid email."
          })
        }

        session.data.email =
          text.toLowerCase() === "skip" ? null : text

        session.step = "time"
        return res.json({
          reply: "Preferred appointment time?"
        })
      }

      /* --- TIME --- */
      if (session.step === "time") {
        if (text.length < 3) {
          return res.json({
            reply: "Please enter a preferred time (e.g., Tomorrow 10 AM)."
          })
        }

        session.data.preferred_time = text

        const preferred_time_at = convertPreferredTimeToUTC(text)

        const lead = {
          bot_id: botId,
          ...session.data,
          preferred_time_at
        }

        await supabase.from("leads").insert(lead)

        if (bot.notification_email) {
          await sendLeadEmail({
            to: bot.notification_email,
            ...lead
          })
        }
        delete leadSessions[key]
       

        return res.json({
          reply:
            "✅ Appointment request sent. The clinic will contact you shortly."
        })
      }
    }

    /* ===== START APPOINTMENT FLOW ===== */
    if (isAppointmentIntent(text)) {
 
      leadSessions[key] = {
        step: "name",
        data: {}
      }
      return res.json({
        reply: "Sure 🙂 May I have your full name?"
      })
    }

    /* ===== NORMAL AI CHAT ===== */
    const finalPrompt =
      bot.system_prompt_locked + "\n\n" + bot.system_prompt_custom

    let reply =
      "🤖 I'm here to help you with appointments and clinic questions."

    try {
      reply = await askGPT(message, finalPrompt)
    } catch (e) {
      console.error("OpenAI error:", e.message)
    }

    await supabase
      .from("users")
      .update({
        used_this_cycle: user.used_this_cycle + 1
      })
      .eq("id", user.id)

    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})


/* =========================
   LEADS
========================= */
app.get("/api/leads/:botId", async (req, res) => {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("bot_id", req.params.botId)
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json(error)
  res.json(data)
})

/* =========================
   WIDGET BRANDING + WHITE LABEL
========================= */
app.get("/api/widget/:botId", async (req, res) => {
  const { botId } = req.params

  const { data: bot } = await supabase
    .from("bots")
    .select("display_name, primary_color, widget_position, user_id")
    .eq("id", botId)
    .single()

  const { data: user } = await supabase
    .from("users")
    .select("plan")
    .eq("id", bot.user_id)
    .single()

  res.json({
    display_name: bot.display_name || "Dental Assistant",
    primary_color: bot.primary_color || "#2563eb",
    white_label: PLAN_LIMITS[user.plan].white_label,
    widget_position: bot.widget_position || "bottom-right"
  })
})

/* =========================
   BOT BRANDING
========================= */
app.put("/api/bots/:botId/branding", async (req, res) => {
  const { primaryColor, displayName, widgetPosition } = req.body

  await supabase
    .from("bots")
    .update({
      primary_color: primaryColor,
      display_name: displayName,
      widget_position: widgetPosition
    })
    .eq("id", req.params.botId)

  res.json({ success: true })
})

/* =========================
   BOT SETTINGS
========================= */
app.put("/api/bots/:botId/email", async (req, res) => {
  await supabase
    .from("bots")
    .update({ notification_email: req.body.email })
    .eq("id", req.params.botId)

  res.json({ success: true })
})

/* =========================
   PLAN UPGRADE (PRE-STRIPE)
========================= */
app.post("/api/upgrade-plan", async (req, res) => {
  const { userId, plan } = req.body
  if (!PLAN_LIMITS[plan]) {
    return res.status(400).json({ error: "Invalid plan" })
  }

  const now = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 30)

  const { data } = await supabase
    .from("users")
    .update({
      plan,
      monthly_limit: PLAN_LIMITS[plan].monthly_limit,
      used_this_cycle: 0,
      billing_start_at: now,
      billing_end_at: end
    })
    .eq("id", userId)
    .select()
    .single()

  res.json({ success: true, user: data })
})

/* =========================
   WebHook
========================= */

app.post("/api/paddle/webhook", async (req, res) => {
  try {
    if (!verifyPaddleSignature(req)) {
      return res.status(401).send("Invalid signature")
    }

    const event = JSON.parse(req.body.toString())
    const { type, data } = event

    console.log("PADDLE EVENT:", type)

    const email = data?.customer?.email
    if (!email) return res.json({ received: true })

    // 🔹 ACTIVATE SUBSCRIPTION
    if (type === "subscription.activated") {
      await supabase
        .from("users")
        .update({
          plan: "starter",
          subscription_status: "active"
        })
        .eq("email", email)
    }

    // 🔹 CANCEL SUBSCRIPTION
    if (type === "subscription.canceled") {
      await supabase
        .from("users")
        .update({
          plan: "free",
          subscription_status: "canceled"
        })
        .eq("email", email)
    }

    res.json({ received: true })
  } catch (err) {
    console.error("PADDLE WEBHOOK ERROR", err)
    res.status(500).send("Webhook error")
  }
})


/* =========================
   USAGE
========================= */
app.get("/api/usage/:userId", async (req, res) => {
  const { data } = await supabase
    .from("users")
    .select("plan, used_this_cycle, monthly_limit, billing_end_at")
    .eq("id", req.params.userId)
    .single()

  res.json({
    plan: data.plan,
    used: data.used_this_cycle,
    limit: data.monthly_limit,
    billing_end_at: data.billing_end_at
  })
})

/* =========================
   COUNTS
========================= */
app.get("/api/bots/count/:userId", async (req, res) => {
  const { count } = await supabase
    .from("bots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", req.params.userId)

  res.json({ count })
})

app.get("/api/appointments/count/:userId", async (req, res) => {
  const { data: bots } = await supabase
    .from("bots")
    .select("id")
    .eq("user_id", req.params.userId)

  if (!bots.length) return res.json({ count: 0 })

  const botIds = bots.map(b => b.id)

  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .in("bot_id", botIds)

  res.json({ count })
})

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})