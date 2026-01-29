import nodemailer from "nodemailer"

/* =========================
   EMAIL TRANSPORT (KEEP)
========================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

/* =========================
   HTML TEMPLATE (NEW)
========================= */
const buildLeadEmailHTML = ({
  name,
  phone,
  email,
  preferred_time
}) => {
  return `
  <div style="
    font-family: Arial, sans-serif;
    background-color: #f9fafb;
    padding: 30px;
  ">
    <div style="
      max-width: 520px;
      margin: auto;
      background: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    ">

      <!-- HEADER -->
      <div style="
        background: #2563eb;
        color: #ffffff;
        padding: 16px;
        text-align: center;
        font-size: 18px;
        font-weight: bold;
      ">
        🦷 New Appointment Request
      </div>

      <!-- BODY -->
      <div style="padding: 20px; color: #111827;">
        <p>Hello,</p>

        <p>
          You have received a <strong>new appointment request</strong>
          from your website chatbot.
        </p>

        <table style="
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
          font-size: 14px;
        ">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Patient Name</td>
            <td style="padding: 8px;">${name}</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding: 8px; font-weight: bold;">Phone</td>
            <td style="padding: 8px;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Email</td>
            <td style="padding: 8px;">
              ${email || "Not provided"}
            </td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding: 8px; font-weight: bold;">Preferred Time</td>
            <td style="padding: 8px;">${preferred_time}</td>
          </tr>
        </table>

        <p style="margin-top: 20px;">
          Please contact the patient to confirm the appointment.
        </p>
      </div>
    </div>
  </div>
  `
}

/* =========================
   TEXT FALLBACK (NEW)
========================= */
const buildLeadEmailText = ({
  name,
  phone,
  email,
  preferred_time
}) => {
  return `
New Appointment Request

Name: ${name}
Phone: ${phone}
Email: ${email || "Not provided"}
Preferred Time: ${preferred_time}

Please contact the patient to confirm.
— DODO
`
}

/* =========================
   SEND EMAIL (UPGRADED)
========================= */
export const sendLeadEmail = async ({
  to,
  name,
  phone,
  email,
  preferred_time
}) => {
  await transporter.sendMail({
    from: `"DODO Assistant" <${process.env.EMAIL_USER}>`,
    to,
    subject: "🦷 New Appointment Request",
    text: buildLeadEmailText({
      name,
      phone,
      email,
      preferred_time
    }),
    html: buildLeadEmailHTML({
      name,
      phone,
      email,
      preferred_time
    })
  })
}