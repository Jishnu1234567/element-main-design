/* ============================================================
   Element Sound Studio — AI chat widget
   Talks to a small serverless backend (see /cloudflare-worker)
   which holds the secret API key and calls Claude with the
   studio's full knowledge base. This file never contains a key —
   see cloudflare-worker/worker.js for the setup instructions.

   TO ACTIVATE: after deploying the Worker (instructions in
   cloudflare-worker/worker.js), paste its URL below.
   ============================================================ */
(function () {
  'use strict';

  var WORKER_URL = 'https://REPLACE-ME.workers.dev'; // <-- paste your deployed Worker URL here
  var IS_CONFIGURED = WORKER_URL.indexOf('REPLACE-ME') === -1;

  var WA_NUMBER = '919895314555';
  function waLink(text) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
  }

  // Starter prompts shown as tappable pills. Tapping one sends the exact
  // text to the AI, same as if the visitor had typed it.
  var QUICK_QUESTIONS = [
    'Where is Element located?',
    'Parking available?',
    'Studio capacity?',
    'What DAWs do you use?',
    'Can I bring my own engineer?',
    'Do you provide musicians?',
    'Can you produce a song from scratch?',
    'Do you handle film audio post-production?',
    'What’s the studio hourly rate?',
    'What training programs do you offer?',
    'How do I book a session?'
  ];

  // ---- Safe markdown rendering ----
  // The AI is instructed to reply using only **bold** and [text](url) —
  // never raw HTML. We escape everything first, then re-introduce just
  // those two safe patterns, so nothing the model (or a crafted visitor
  // message) produces can inject a real HTML element into the page.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function renderSafeMarkdown(text) {
    var out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|[a-zA-Z0-9_-]+\.html[^\s)]*)\)/g, function (_, label, url) {
      var isExternal = /^https?:\/\//.test(url);
      return '<a href="' + url + '"' + (isExternal ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });
    return out;
  }

  // ---- DOM ----
  var fab, panel, body, form, input;
  var hasGreeted = false;
  var history = []; // { role: 'user'|'assistant', content: string }
  var isWaiting = false;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function scrollToBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function addMessage(html, sender) {
    var msg = el('div', 'chatbot-msg chatbot-msg--' + sender, html);
    body.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function addTyping() {
    var t = el('div', 'chatbot-typing', '<span></span><span></span><span></span>');
    body.appendChild(t);
    scrollToBottom();
    return t;
  }

  function clearPrompts() {
    var old = body.querySelector('.chatbot-quick');
    if (old) old.remove();
  }

  function fallbackMessage() {
    return 'I couldn’t reach my brain just now — but our team can help directly. ' +
      '<a href="' + waLink('Hi! I have a question about Element Sound Studio.') + '" target="_blank" rel="noopener">Ask us on WhatsApp &rarr;</a>';
  }

  function notConfiguredMessage() {
    return 'The AI backend isn’t connected yet — for now, the fastest way to get an answer is WhatsApp. ' +
      '<a href="' + waLink('Hi! I have a question about Element Sound Studio.') + '" target="_blank" rel="noopener">Chat with us &rarr;</a>';
  }

  function askAI(userText) {
    if (isWaiting) return;
    isWaiting = true;
    var typing = addTyping();

    if (!IS_CONFIGURED) {
      setTimeout(function () {
        typing.remove();
        addMessage(notConfiguredMessage(), 'bot');
        renderMoreLink();
        isWaiting = false;
      }, 500);
      return;
    }

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, history: history.slice(-8) })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        typing.remove();
        var reply = data && data.reply ? data.reply.trim() : '';
        if (!reply) throw new Error('empty reply');
        history.push({ role: 'user', content: userText });
        history.push({ role: 'assistant', content: reply });
        addMessage(renderSafeMarkdown(reply), 'bot');
        renderMoreLink();
      })
      .catch(function () {
        typing.remove();
        addMessage(fallbackMessage(), 'bot');
        renderMoreLink();
      })
      .then(function () {
        isWaiting = false;
      });
  }

  function renderQuickReplies() {
    clearPrompts();
    var wrap = el('div', 'chatbot-quick');
    wrap.appendChild(el('span', 'chatbot-quick__label', 'Common questions'));
    QUICK_QUESTIONS.forEach(function (q) {
      var btn = el('button', 'chatbot-quick__btn', escapeHtml(q));
      btn.type = 'button';
      btn.addEventListener('click', function () {
        clearPrompts();
        addMessage(escapeHtml(q), 'user');
        askAI(q);
      });
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    scrollToBottom();
  }

  function renderMoreLink() {
    clearPrompts();
    var wrap = el('div', 'chatbot-quick');
    var btn = el('button', 'chatbot-quick__btn', 'See all questions again');
    btn.type = 'button';
    btn.addEventListener('click', renderQuickReplies);
    wrap.appendChild(btn);
    body.appendChild(wrap);
    scrollToBottom();
  }

  function greet() {
    if (hasGreeted) return;
    hasGreeted = true;
    addMessage('Hi! I’m Element’s AI assistant — ask me anything about the studio, or tap a question below.', 'bot');
    renderQuickReplies();
  }

  function openPanel() {
    panel.classList.add('is-open');
    fab.classList.add('is-open');
    fab.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    greet();
    setTimeout(function () { input.focus(); }, 300);
  }
  function closePanel() {
    panel.classList.remove('is-open');
    fab.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
  }

  function build() {
    fab = el('button', 'chatbot-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open chat with Element’s assistant');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML =
      '<svg class="chatbot-fab__icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<svg class="chatbot-fab__icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '<span class="chatbot-fab__dot"></span>';

    panel = el('div', 'chatbot-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Element Sound Studio assistant');
    panel.setAttribute('aria-hidden', 'true');

    var header = el('div', 'chatbot-panel__header');
    header.innerHTML =
      '<div class="chatbot-panel__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>' +
      '<div><div class="chatbot-panel__title">Ask Element</div><div class="chatbot-panel__subtitle">AI assistant, 24/7</div></div>';
    var closeBtn = el('button', 'chatbot-panel__close', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.addEventListener('click', closePanel);
    header.appendChild(closeBtn);

    body = el('div', 'chatbot-panel__body');

    var footer = el('div', 'chatbot-panel__footer');
    form = el('form', null);
    form.style.display = 'contents';
    input = el('input', 'chatbot-input');
    input.type = 'text';
    input.placeholder = 'Type a question…';
    input.setAttribute('aria-label', 'Type your question');
    var sendBtn = el('button', 'chatbot-send', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>');
    sendBtn.type = 'submit';
    sendBtn.setAttribute('aria-label', 'Send');
    form.appendChild(input);
    form.appendChild(sendBtn);
    footer.appendChild(form);

    var waFooter = el('div', 'chatbot-panel__whatsapp',
      'Prefer a real person? <a href="' + waLink('Hi! I would like to know more about Element Sound Studio.') + '" target="_blank" rel="noopener">Chat with us on WhatsApp</a>'
    );

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    panel.appendChild(waFooter);

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    fab.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) closePanel(); else openPanel();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val || isWaiting) return;
      clearPrompts();
      addMessage(escapeHtml(val), 'user');
      input.value = '';
      askAI(val);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
