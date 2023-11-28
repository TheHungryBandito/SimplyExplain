// Gets the user's current active tab.
async function getCurrentTabId() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab.id;
}

// Relay the text the user is selecting to the service worker
async function relaySelectedText() {
  return await chrome.runtime.sendMessage({
    type: "selectionText",
    text: getSelection().toString()
  });
}

// Runs text through Text-To-Speech
async function speakText(text) {
  return await chrome.storage.sync.get(
    {
      "TTS": "tts-1",
      "Voice": "alloy"
    })
    .then(async (syncStorage) => {
      if (syncStorage.TTS == "tts-1" || syncStorage.TTS == "tts-1-hd") {
        return await chrome.storage.local.get(["OpenAIKey"]).then(async (storage) => {
          return await fetchRequestForOpenAITTS(text, syncStorage.TTS, syncStorage.Voice, storage.OpenAIKey).then((blob) => {
            setupOffscreenDocument('pages/audio-playback.html', ['AUDIO_PLAYBACK', 'BLOBS'], 'Playing Text-To-Speech');
            sendBlobToOffscreen(blob);
          })
            .catch((err) => {
              console.error('Failed to get OpenAI Text-To-Speech -', err);
              return false;
            })
        });
      }
      else if (syncStorage.TTS == "tts-chrome") {
        chrome.tts.stop();
        return chrome.tts.speak(
          text,
          { 'lang': 'en-US' },
          function () {
            if (chrome.runtime.lastError) {
              console.error('Chrome TTS failed to speak -' + chrome.runtime.lastError.message);
            }
          }
        );
      }
    });
}

// Sets up an offscreen document if one does not already exist.
async function setupOffscreenDocument(url, reasons, justification) {
  if (await hasOffscreenDocument(url)) {
    return true;
  } else {
    return chrome.offscreen.createDocument({
      url: url,
      reasons: reasons,
      justification: justification,
    },
      function () {
        if (chrome.runtime.lastError) {
          console.error(`Failed to create offscreen document URL[${url}] JUSTIFICATION[${justification}] -` + chrome.runtime.lastError.message);
        }
      });
  }
}

// Checks if there is an active offscreen.
async function hasOffscreenDocument(url) {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [url]
    });
    return Boolean(contexts.length);
  } else {
    const matchedClients = await clients.matchAll();
    return await matchedClients.some(client => {
      client.url.includes(chrome.runtime.id);
    });
  }
}

// Returns current GPT Instructions.
async function getGPTInstructions() {
  return await chrome.storage.sync.get({
    "Persona": "mentor",
    "BotAction": "explain the concept of the text",
    "ReadingLevel": "beginner",
    "WordLimit": "30",
    "GPTModel": "gpt-3.5"
  })
    .then((botOptions) => {
      // Adjust for grammer/punctuation.
      if (botOptions.ReadingLevel == "beginner") {
        return `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a ${botOptions.ReadingLevel} level. 
                Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
      }
      else {
        return `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at an ${botOptions.ReadingLevel} level. 
                Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
      }
    })
    .catch((err) => {
      console.error('Could not create GPT Instructions', err);
      return false;
    });
}

// Sends API request to GPT model, returns text completion.
async function fetchCompletionRequestToGPT(instructions, model, text, apiKey) {
  return await fetch(
    new URL("https://api.openai.com/v1/chat/completions"), {
    method: 'POST',
    headers: {
      'Authorization': "Bearer " + apiKey,
      'Content-Type': "application/json"
    },
    body: JSON.stringify({
      "model": model,
      "messages": [
        {
          "role": "system",
          "content": instructions
        },
        {
          "role": "user",
          "content": text
        }
      ],
      "temperature": 0.2
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Fetch request failed - Status: ", ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      if (!data.choices[0]) {
        throw new Error("GPT could not respond.")
      }
      return data;
    })
    .catch((err) => {
      console.err("Failed to send completion request to GPT -", err);
      return false;
    });
}

// Sends API request to TTS model, returns mp3/mpeg blob.
async function fetchRequestForOpenAITTS(text, model, voice, apiKey) {
  return await fetch(
    new URL("https://api.openai.com/v1/audio/speech"), {
    method: 'POST',
    headers: {
      'Authorization': "Bearer " + apiKey,
      'Content-Type': "application/json"
    },
    body: JSON.stringify({
      "model": model,
      "input": text,
      "voice": voice
    })
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Fetch Failed: ${response.statusText} Status: ${response.status}`);
      }
      return response.blob();
    })
}

// Gets fetch requirements then returns the text completion data.
async function getCompletionResults(text) {
  const instructions = await getGPTInstructions();
  if (!instructions) {
    return false;
  }

  return await chrome.storage.local.get({ "OpenAIKey": false }).then(async (storage) => {
    if (!storage.OpenAIKey) {
      throw new Error("No api key found.");
    }
    return await fetchCompletionRequestToGPT(instructions, GPTModel, text, storage.OpenAIKey)
  })
    .catch((err) => {
      console.log("Could not find API Key -", err)
      return false;
    });
}

// Gets a response to the text then speaks it.
async function processText(text) {
  await getCompletionResults(text).then(data => {
    speakText(data.choices[0].message.content);
  });
}

// Authenticate user with google.
async function auth() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const clientID = '849293445118-toonlns3d7fmocfcn4g8qvoc49neqmhn.apps.googleusercontent.com';
  const redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const nonce = Math.random().toString(36).substring(2, 15);

  authUrl.searchParams.set('client_id', clientID);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('prompt', 'consent');

  return chrome.identity.launchWebAuthFlow({
    url: authUrl.href,
    interactive: true,

  })
    .then((url) => {
      const splitURL = url.toString().split("#id_token=");
      if (splitURL.length < 1) {
        return false;
      }
      return splitURL[1];
    })
    .then((idToken) => {
      if (idToken) {
        chrome.storage.local.set({ UserID: idToken });
      } else {
        throw new Error("OAuth 2.0 Error. Failed to retrieve Id_Token.");
      }
    }).catch((err) => {
      console.error("OAuth 2.0 Error. Could not authenticate user:", err);
    });
}

// Authenticates user then runs callback.
async function authFlow(callback) {
  const userLoggedIn = await isLoggedIn();
  if (!userLoggedIn) {
    auth().then(
      function success(result) {
        console.log(result);
        callback();
      },
      function failure(result) {
        console.log(result);
      })
      .catch((err) => {
        console.error('Failure to authenticate:', err);
      });
    return;
  }

  callback();
}

// Checks if user has previously logged in.
async function isLoggedIn() {
  return chrome.storage.local.get({
    "UserID": null
  })
    .then((storage) => {
      // If we have a UserID then the user has authenticated.
      if (storage.UserID !== "None") {
        console.log("Recieved UserID:", storage.UserID);
        return true;
      } else {
        console.log("No UserID found in storage.");
        return false;
      }
    });
}

// Opens the admin panel.
async function openAdminPanel() {
  let currentTab = await chrome.tabs.query({ active: true });
  chrome.tabs.create({
    active: true,
    url: chrome.runtime.getURL("../pages/admin-panel.html"),
    windowId: currentTab[0].windowId
  });
}

// Converts blob to json.stringify()-able format then sends it to offscreen.
function sendBlobToOffscreen() {
  var reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = () => {
    var base64String = reader.result.split(',')[1];
    chrome.runtime.sendMessage({
      text: base64String,
      target: 'offscreen',
    }, (response) => {
      console.log("recieved", response);
    })
      .catch((err) => {
        console.error("Failed to send message to offscreen -", err);
      });
  }
}

// Uninstalls the chrome extension from the user's browser
function uninstall() {
  chrome.management.uninstallSelf({
    showConfirmDialog: true
  });
}

// Sets up events/menus for app.
function setupExtension() {
  // Right-click context menu replaces itself with new selection.
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: "explain-btn",
      title: "Explain: '%s'",
      contexts: ["selection"]
    });
  });

  // Right-click menu behaviour
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    authFlow(processText.bind(null, info.selectionText));
  });

  // Recieve the selected text.
  chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
      if (!message.type !== "selectionText") {
        return;
      }
      if (!message.text) {
        return;
      }
      authFlow(processText.bind(null, message.text));
    }
  );

  // On Keyboard shortcut, process selected text.
  chrome.commands.onCommand.addListener((command) => {
    getCurrentTabId().then((id) => {
      chrome.scripting.executeScript({
        target: { tabId: id },
        func: relaySelectedText
      });
    });
  });

  // When extension icon clicked, open the admin panel.
  chrome.action.onClicked.addListener(function () {
    authFlow(openAdminPanel);
  });
}

setupExtension();