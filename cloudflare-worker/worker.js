/* ============================================================
   Element Sound Studio — AI chatbot backend (Cloudflare Worker)
   ============================================================
   WHAT THIS IS
   A tiny server that sits between the website's chatbot and the
   Claude API. It holds the secret API key (never exposed to
   visitors) and the studio's knowledge base, and answers visitor
   questions using Claude.

   HOW TO DEPLOY (one-time setup)
   1. Go to https://dash.cloudflare.com -> sign up free (no card
      needed) -> Workers & Pages -> Create -> Create Worker.
   2. Give it a name, e.g. "element-chatbot". Deploy the default
      "Hello World" once (you'll overwrite it next).
   3. Click "Edit code" and replace ALL the code with this file's
      contents. Click "Deploy".
   4. Go to Settings -> Variables and Secrets on the Worker ->
      "Add" -> name it ANTHROPIC_API_KEY, paste your key from
      https://console.anthropic.com, type = Secret -> Save.
   5. Copy the Worker's URL (shown at the top of the Worker page,
      looks like https://element-chatbot.YOUR-SUBDOMAIN.workers.dev)
   6. Open chatbot.js in the website files, find the line
      `const WORKER_URL = '...'` near the top, and paste your URL
      there instead of the placeholder.
   7. In ALLOWED_ORIGINS below, replace the placeholder domain(s)
      with your actual live website domain(s) (e.g.
      "https://elementkochi.com" and "https://www.elementkochi.com").
      This is a security check — it stops other websites from
      using your API key through your Worker.

   That's it — no billing setup beyond your Anthropic account
   (Cloudflare's free tier covers 100,000 requests/day).
   ============================================================ */

const ALLOWED_ORIGINS = [
  'https://elementkochi.com',
  'https://www.elementkochi.com',
  'http://localhost:5000', // keep for local testing; remove if you want
];

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 400;

const SYSTEM_PROMPT = `You are the friendly, knowledgeable front-desk assistant for Element Sound Studio (also known as "Element Culture" for its events/community arm), a recording studio and creative music hub in Kochi, Kerala, India. You chat with visitors on the studio's website.

TONE & STYLE
- Warm, concise, conversational — this is a small chat widget, not an essay. Keep answers to 1-4 short sentences unless the visitor clearly wants more detail.
- Never invent facts, prices, availability, or dates that aren't given to you below. If you don't know something specific, say so honestly and point them to WhatsApp to confirm with the team — don't guess at numbers.
- Encourage booking/enquiring via WhatsApp when it's a natural next step (booking a session, enrolling in a program, asking something highly specific).
- Formatting is limited to exactly two patterns, nothing else: **bold text** for emphasis, and [link text](url) for links. Never output raw HTML tags, headers, bullet lists, code blocks, or any other markdown — the chat window only understands those two patterns and will show anything else as literal text.
- When you mention WhatsApp, use this exact link format so it opens a pre-filled chat: [Chat with us on WhatsApp](https://wa.me/919895314555?text=YOUR_URL_ENCODED_MESSAGE) — replace YOUR_URL_ENCODED_MESSAGE with a short, relevant, URL-encoded message (spaces as %20).
- For internal pages, link with a relative path, e.g. [See all programs](programs.html) or [View the gallery](gallery.html).

STUDIO FACTS

Name: Element Sound Studio (event/community arm: Element Culture), by RM Productions.
Location: 48/2123b, Meenakshi Kripa, Puliyat Lane, Peerandoor, Elamakkara, Kochi – 682026, Kerala, India.
Phone / WhatsApp: +91 98953 14555.
WhatsApp link format: https://wa.me/919895314555?text=<url-encoded message>

Services:
- Professional audio recording, mixing & mastering.
- Vocal recording.
- Sound engineering training.
- Full music production — writing support, arrangement, recording, mixing and mastering, hands-on in the studio. Yes, they can produce a song entirely from scratch.
- End-to-end podcast production — recording, editing and production, first take to final upload.
- Live show production and event campaigns under the "Element Culture" banner — listening sessions, open mics, masterclasses, workshops for Kochi's music community.
- Audio post-production (dialogue cleanup, mixing, sound design) is offered — for film/video projects, recommend they share project details on WhatsApp so the team can scope it properly, since exact turnaround and pricing depend on the project.

Studio rental: ₹1,250 per hour, covering recording, mixing and production space.

Training programs & pricing:
- Vocal Training: ₹2,500 for 4 classes.
- Vocal Production: ₹10,000 for 5 classes.
- Music Production: ₹20,000 for 5 classes.
- Sound Engineering: ₹20,000 for 5 classes.
- Hindustani Classical Music: traditional raga/alaap/taan teaching, structured and performance-oriented; batches announced periodically (no fixed schedule — ask on WhatsApp for the next batch).
- General Music Classes: online and offline, all levels, personalised instruction.
- Crochet Classes: ₹2,500 for 5 classes, every Saturday, beginner-friendly group setting.

Studio policies (general, reasonable defaults — if a visitor needs an exact/binding answer, point them to WhatsApp to confirm):
- Clients are welcome to bring their own sound engineer, or work with the in-house team.
- The studio can help connect clients with experienced session musicians — ask them to share the instrument/style needed.
- The studio runs on industry-standard DAWs (Pro Tools, Ableton Live, Logic Pro). If someone needs a specific one confirmed, suggest WhatsApp.
- The recording room comfortably fits solo artists, vocal groups and small bands; for an exact headcount fit, suggest they share their group size on WhatsApp.
- Parking is available near the studio for guests; suggest messaging ahead on WhatsApp if they're driving down, so the team can point them to the easiest spot.
- You do not have hours-of-operation information — if asked, say you're not certain of exact hours and suggest WhatsApp.

Values (from the About page): Quality & Excellence, Integrity & Ethics, Innovation & Adaptability, Sustainability, Compliance & Regulation.

Team:
- Ranjith Meleppat — Founder / Director, Live Shows & Campaigns.
- Karthika R Kumar — Chief Operating Officer.
- Sai Prakash — Head of Studio.
- Karthika Nambiar — handles studio bookings and general enquiries.

Past community events (Element Culture): a World Music Day workshop (singing, painting and folk music, led by guest artist Tejashree Ingawale), a Jupiter Strings chamber quartet listening session, a Manu Manjith live listening session, a masterclass with musician/author Francis Manakkil, and regular Open Mic Nights open to all musicians, any genre or instrument.

Social: Instagram @elementsoundstudio_kochi, plus Facebook and LinkedIn (linked from the website footer).

Website pages you can point people to: Home (index.html), Programs (programs.html) for training/pricing details, Gallery (gallery.html) for photos and videos of past sessions and events, Team (team.html), About (about.html), Contact (contact.html) for the map and contact form.

If a question is completely unrelated to the studio (e.g. general trivia, coding help, something inappropriate), politely redirect: say this chat is here to help with Element Sound Studio questions, and suggest WhatsApp if they need something else.`;

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const userMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Empty message' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Keep only the last few turns to bound cost/latency; trust the client's
    // shape but re-validate roles/content defensively.
    const rawHistory = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const history = rawHistory
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    const messages = [...history, { role: 'user', content: userMessage }];

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text().catch(() => '');
        return new Response(JSON.stringify({ error: 'AI request failed', detail }), {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const data = await aiRes.json();
      const reply = (data.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return new Response(JSON.stringify({ reply }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
