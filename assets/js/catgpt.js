---
---

const topics = {{ site.data.topics | jsonify }};
const flows = {{ site.data.flows | jsonify }};

const topicBank = Object.fromEntries(
  topics.map(topic => [topic.id, topic])
);

let lastPresetId = null;
let activeConversation = null;
let isResponding = false;
let autoSubmitTimer = null;
let keyTimes = [];
let hintTimer = null;

const sidebar = document.getElementById("sidebar");
const sidebarScrim = document.getElementById("sidebarScrim");
const sidebarOpen = document.getElementById("sidebarOpen");
const sidebarClose = document.getElementById("sidebarClose");
const newChat = document.getElementById("newChat");
const searchButton = document.getElementById("searchButton");
const shareButton = document.getElementById("shareButton");
const welcome = document.getElementById("welcome");
const messages = document.getElementById("messages");
const chatViewport = document.getElementById("chatViewport");
const promptInput = document.getElementById("promptInput");
const sendButton = document.getElementById("sendButton");
const mashHint = document.getElementById("mashHint");

function catIcon() {
  return `
    <span class="assistant-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <use href="#icon-cat"></use>
      </svg>
    </span>
  `;
}

function escapeHTML(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function resizeInput() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 150)}px`;
}

function syncSendButton() {
  sendButton.disabled =
    isResponding ||
    promptInput.value.trim().length === 0;
}

function setInput(value) {
  promptInput.value = value;
  resizeInput();
  syncSendButton();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatViewport.scrollTop = chatViewport.scrollHeight;
  });
}

function topicWeight(topic) {
  const weight = Number(topic.weight);

  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(0, weight);
}

function choosePreset() {
  if (topics.length === 0) {
    return null;
  }

  const candidates = topics.filter(
    topic => topics.length === 1 || topic.id !== lastPresetId
  );

  let weightedCandidates = candidates
    .map(topic => ({
      topic,
      weight: topicWeight(topic)
    }))
    .filter(candidate => candidate.weight > 0);

  if (weightedCandidates.length === 0) {
    weightedCandidates = candidates.map(topic => ({
      topic,
      weight: 1
    }));
  }

  const totalWeight = weightedCandidates.reduce(
    (sum, candidate) => sum + candidate.weight,
    0
  );

  let threshold = Math.random() * totalWeight;

  for (const candidate of weightedCandidates) {
    threshold -= candidate.weight;

    if (threshold <= 0) {
      return candidate.topic.id;
    }
  }

  return weightedCandidates[weightedCandidates.length - 1].topic.id;
}

function validFlowTurn(turn) {
  return Boolean(
    turn &&
    typeof turn.inference === "string" &&
    Array.isArray(turn.response) &&
    turn.response.length > 0
  );
}

function flowForTopic(topic) {
  if (!topic || !topic.style) {
    return null;
  }

  const flow = flows[topic.style];

  if (
    !flow ||
    !Array.isArray(flow.continuations) ||
    flow.continuations.length === 0 ||
    !flow.continuations.every(validFlowTurn) ||
    !validFlowTurn(flow.closing)
  ) {
    return null;
  }

  return flow;
}

function chooseConversationLength(flow) {
  if (!flow) {
    return 1;
  }

  const maximumLength = Math.min(
    5,
    flow.continuations.length + 2
  );

  if (maximumLength < 3) {
    return maximumLength;
  }

  return 3 + Math.floor(
    Math.random() * (maximumLength - 2)
  );
}

function startConversation(topicId) {
  const topic = topicBank[topicId];

  if (!topic) {
    return null;
  }

  const flow = flowForTopic(topic);

  activeConversation = {
    topicId,
    turn: 1,
    continuationIndex: 0,
    targetLength: chooseConversationLength(flow)
  };

  lastPresetId = topicId;

  return {
    topic,
    inference: topic.inference,
    response: topic.response
  };
}

function continueConversation() {
  if (!activeConversation) {
    return null;
  }

  const topic = topicBank[activeConversation.topicId];

  if (!topic) {
    activeConversation = null;
    return null;
  }

  const flow = flowForTopic(topic);

  if (
    !flow ||
    activeConversation.turn >= activeConversation.targetLength
  ) {
    activeConversation = null;
    return null;
  }

  const nextTurnNumber = activeConversation.turn + 1;

  const isClosingTurn =
    nextTurnNumber === activeConversation.targetLength;

  let turn;

  if (isClosingTurn) {
    turn = flow.closing;
  } else {
    turn = flow.continuations[
      activeConversation.continuationIndex
    ];

    activeConversation.continuationIndex += 1;
  }

  if (!validFlowTurn(turn)) {
    activeConversation = null;
    return null;
  }

  activeConversation.turn = nextTurnNumber;

  return {
    topic,
    inference: turn.inference,
    response: turn.response
  };
}

function chooseResponseTurn(forcedPreset = null) {
  if (forcedPreset) {
    return startConversation(forcedPreset);
  }

  const continuation = continueConversation();

  if (continuation) {
    return continuation;
  }

  const preset = choosePreset();

  if (!preset) {
    return null;
  }

  return startConversation(preset);
}

function showHint() {
  clearTimeout(hintTimer);

  mashHint.classList.add("is-visible");

  hintTimer = setTimeout(() => {
    mashHint.classList.remove("is-visible");
  }, 1100);
}

function addUserMessage(text) {
  const row = document.createElement("div");

  row.className = "message-row user";

  row.innerHTML = `
    <div class="user-bubble">${escapeHTML(text)}</div>
  `;

  messages.appendChild(row);
}

function addAssistantShell() {
  const row = document.createElement("div");

  row.className = "message-row assistant";

  row.innerHTML = `
    <div class="assistant-message">
      ${catIcon()}
      <div class="assistant-copy">
        <div class="typing" aria-label="Thinking">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
    </div>
  `;

  messages.appendChild(row);

  return row.querySelector(".assistant-copy");
}

function activateConversation() {
  welcome.style.display = "none";
  messages.classList.add("is-active");
}

function streamParagraphs(container, paragraphs) {
  return new Promise(resolve => {
    container.innerHTML = "";

    let paragraphIndex = 0;

    function startParagraph() {
      if (paragraphIndex >= paragraphs.length) {
        resolve();
        return;
      }

      const paragraph = document.createElement("p");
      container.appendChild(paragraph);

      const words = paragraphs[paragraphIndex].split(" ");
      let wordIndex = 0;

      function addWord() {
        if (wordIndex >= words.length) {
          paragraphIndex += 1;
          scrollToBottom();

          setTimeout(startParagraph, 130);
          return;
        }

        paragraph.textContent +=
          (wordIndex === 0 ? "" : " ") +
          words[wordIndex];

        wordIndex += 1;

        scrollToBottom();

        const delay =
          18 +
          Math.floor(Math.random() * 19);

        setTimeout(addWord, delay);
      }

      addWord();
    }

    startParagraph();
  });
}

async function submitCatMessage(text, forcedPreset = null) {
  const clean = text.trim();

  if (!clean || isResponding) {
    return;
  }

  isResponding = true;

  clearTimeout(autoSubmitTimer);

  keyTimes = [];

  syncSendButton();

  activateConversation();

  addUserMessage(clean);

  setInput("");

  scrollToBottom();

  const assistantCopy = addAssistantShell();

  scrollToBottom();

  const pause =
    650 +
    Math.floor(Math.random() * 650);

  await new Promise(resolve => {
    setTimeout(resolve, pause);
  });

  const responseTurn =
    chooseResponseTurn(forcedPreset);

  if (!responseTurn) {
    assistantCopy.textContent =
      "CatGPT could not find an appropriate feline interpretation.";

    isResponding = false;
    syncSendButton();

    return;
  }

  await streamParagraphs(
    assistantCopy,
    [
      responseTurn.inference,
      ...responseTurn.response
    ]
  );

  isResponding = false;

  syncSendButton();

  promptInput.focus({
    preventScroll: true
  });
}

function submitCurrent() {
  submitCatMessage(promptInput.value);
}

function resetChat() {
  clearTimeout(autoSubmitTimer);

  keyTimes = [];

  activeConversation = null;
  lastPresetId = null;
  isResponding = false;

  messages.innerHTML = "";
  messages.classList.remove("is-active");

  welcome.style.display = "";

  setInput("");

  closeSidebar();

  chatViewport.scrollTop = 0;

  promptInput.focus({
    preventScroll: true
  });
}

function startFreshPresetConversation(topic) {
  if (!topic || isResponding) {
    return;
  }

  resetChat();

  submitCatMessage(
    topic.mash,
    topic.id
  );
}

function openSidebar() {
  sidebar.classList.add("is-open");
  sidebarScrim.classList.add("is-open");
}

function closeSidebar() {
  sidebar.classList.remove("is-open");
  sidebarScrim.classList.remove("is-open");
}

function noteMashKey() {
  const now = performance.now();

  keyTimes.push(now);

  keyTimes = keyTimes.filter(
    time => now - time < 900
  );

  if (
    keyTimes.length >= 6 &&
    !isResponding
  ) {
    showHint();

    clearTimeout(autoSubmitTimer);

    autoSubmitTimer = setTimeout(() => {
      if (promptInput.value.trim()) {
        submitCurrent();
      }
    }, 430);

    keyTimes = [];
  }
}

function handleGlobalKeydown(event) {
  if (isResponding) {
    return;
  }

  if (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return;
  }

  if (event.key === "Escape") {
    closeSidebar();
    return;
  }

  const targetTag = event.target.tagName;

  const isInteractiveButton =
    targetTag === "BUTTON";

  if (isInteractiveButton) {
    return;
  }

  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    submitCurrent();

    return;
  }

  if (event.key === "Backspace") {
    if (document.activeElement !== promptInput) {
      event.preventDefault();

      setInput(
        promptInput.value.slice(0, -1)
      );
    }

    return;
  }

  if (event.key.length === 1) {
    noteMashKey();

    if (document.activeElement !== promptInput) {
      event.preventDefault();

      setInput(
        promptInput.value +
        event.key
      );
    }
  }
}

promptInput.addEventListener(
  "input",
  () => {
    resizeInput();
    syncSendButton();
  }
);

promptInput.addEventListener(
  "keydown",
  event => {
    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      noteMashKey();
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      submitCurrent();
    }
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (document.activeElement === promptInput) {
      return;
    }

    handleGlobalKeydown(event);
  }
);

sendButton.addEventListener(
  "click",
  submitCurrent
);

newChat.addEventListener(
  "click",
  resetChat
);

sidebarOpen.addEventListener(
  "click",
  openSidebar
);

sidebarClose.addEventListener(
  "click",
  closeSidebar
);

sidebarScrim.addEventListener(
  "click",
  closeSidebar
);

searchButton.addEventListener(
  "click",
  () => {
    setInput("mmmmrrrrp");

    closeSidebar();

    promptInput.focus();
  }
);

shareButton.addEventListener(
  "click",
  async () => {
    const original =
      shareButton.innerHTML;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "CatGPT",
          text: "CatGPT: a keyboard interface for cats.",
          url: window.location.href
        });

        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          window.location.href
        );

        shareButton.textContent = "Copied";

        setTimeout(() => {
          shareButton.innerHTML =
            original;
        }, 1200);
      }
    } catch (error) {
      shareButton.innerHTML =
        original;
    }
  }
);

document
  .querySelectorAll("[data-preset]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        if (isResponding) {
          return;
        }

        const preset =
          button.dataset.preset;

        const topic =
          topicBank[preset];

        if (!topic) {
          return;
        }

        if (button.classList.contains("recent-button")) {
          startFreshPresetConversation(topic);
          return;
        }

        closeSidebar();

        submitCatMessage(
          topic.mash,
          preset
        );
      }
    );
  });

window.addEventListener(
  "resize",
  () => {
    if (window.innerWidth > 860) {
      closeSidebar();
    }
  }
);

syncSendButton();
