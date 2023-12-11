/**
 * Creates Commands/Context Menus
 */
function setupExtension() {
  // Right-click context menu replaces itself with new selection.
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: 'explain-btn',
      title: 'Explain: \'%s\'',
      contexts: ['selection'],
    });
  });

  // Right-click menu behaviour
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (tab.url.includes('chrome://')) {
      await pushNotification({
        title: 'Simply Explain - Error',
        type: 'basic',
        message: 'Unable to use extension on \'chrome://\' URLs.',
        requireInteraction: false,
      });
      return;
    }
    await authRequired(processText.bind(null, info.selectionText));
  });

  // Recieve the selected text.
  chrome.runtime.onMessage.addListener(handleMessages);

  // On Keyboard shortcut, process selected text.
  chrome.commands.onCommand.addListener(handleCommands);

  // When extension icon clicked, open the admin panel.
  chrome.action.onClicked.addListener(async () => {
    await authRequired(openAdminPanel);
  });
}

/**
 * Ensures correct commands are executed.
 * @param {string} command The executed command.
 */
async function handleCommands(command) {
  switch (command) {
    case 'explain':
      await injectFunctionIntoCurrentTab(relaySelectedText);
      break;
  }
}

/**
 * Handles incoming messages from chrome.runtime.
 * @param {*} message Received message.
 * @param {chrome.runtime.MessageSender} sender Message sender.
 * @param {Function} sendResponse Callback to send a response.
 * @return {void}
 */
async function handleMessages(message, sender, sendResponse) {
  if (message.target !== 'service-worker') {
    return;
  }

  switch (message.type) {
    case 'selectionText':
      await authRequired(processText.bind(null, message.text));
      break;
    case 'openAdminPanel':
      await authRequired(openAdminPanel);
      break;
    case 'speakAgain':
      await authRequired(speakLastResponse);
      break;
  }
}

/**
 * Runs injected script on current tab.
 * @param {func} func The function to inject.
 */
async function injectFunctionIntoCurrentTab(func) {
  getCurrentTabId().then((id) => {
    chrome.scripting.executeScript({
      target: {tabId: id},
      func: func,
    })
        .catch((err) => {
          pushNotification({
            title: 'Simply Explain - Error',
            type: 'basic',
            message: err.message,
            requireInteraction: false,
          });
        });
  });
}

/**
 * Queries for the current tab to return it's id.
 * @return {number | undefined} The current tab id.
 */
async function getCurrentTabId() {
  const queryOptions = {active: true, lastFocusedWindow: true};
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab.id;
}

/**
 * Sends the user's selected text through message channel as 'selectionText'.
 * @return {Promise} A promise containing selected text.
 */
async function relaySelectedText() {
  return await chrome.runtime.sendMessage({
    type: 'selectionText',
    target: 'service-worker',
    text: getSelection().toString(),
  });
}

/**
 * Creates a new offscreen if it does not already exist.
 * @param {string} url The (relative) url of the offscreen document.
 * @param {string[]} reasons The reasons for creating the offscreen.
 * @param {string} justification The developer provided justification
 * for creating the offscreen.
 * @return {Promise}
 */
async function setupOffscreenDocument(url, reasons, justification) {
  return await new Promise(async (resolve, reject) => {
    const hasOffscreen = await hasOffscreenDocument(url);
    if (hasOffscreen) {
      return resolve(true);
    }

    await chrome.offscreen.createDocument({
      url: url,
      reasons: reasons,
      justification: justification,
    }).catch((err) => {
      console.error(`Failed to create offscreen document URL: "${url}" 
      JUSTIFICATION: "${justification}" -`, err);
      return reject(err);
    });
    return resolve(true);
  });
}

/**
 * For >= chrome 116 - Checks contexts for existing offscreen.
 * For < chrome 116 - Matches all clients to check if there
 * is an existing offscreen.
 * @param {string} url The (relative) url of the offscreen document.
 * @return {boolean} Returns true if offscreen found.
 */
async function hasOffscreenDocument(url) {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(url)],
    });
    return Boolean(contexts.length);
  } else {
    const matchedClients = await clients.matchAll();
    return await matchedClients.some((client) => {
      client.url.includes(chrome.runtime.id);
    });
  }
}

/**
 * Authenticates with OAuth web flow.
 * @return {Promise<string>} A promise containing the id token of
 * the authenticated user.
 */
async function auth() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const clientID = `849293445118-toonlns3d7fmocfcn4g8qvoc49neqmhn.
  apps.googleusercontent.com`;
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
        const splitURL = url.toString().split('#id_token=');
        if (splitURL.length < 1) {
          return false;
        }
        return splitURL[1];
      })
      .then((idToken) => {
        if (idToken) {
          chrome.storage.local.set({UserID: idToken});
        } else {
          throw new Error('OAuth 2.0 Error. Failed to retrieve Id_Token.');
        }
        return idToken;
      }).catch((err) => {
        console.error('OAuth 2.0 Error. Could not authenticate user:', err);
      });
}

/**
 * Ensures user is authenticated before executing callback.
 * @param {func} callback The callback function to be called
 * if user authenticates successfully.
 */
async function authRequired(callback) {
  const userLoggedIn = await isLoggedIn();
  if (!userLoggedIn) {
    await auth().then(
        function success(result) {
          console.log('Authentication success.');
          callback();
        },
        function failure(result) {
          console.log('Authentication failure.');
        })
        .catch((err) => {
          console.error('Failure to authenticate:', err);
        });
    return;
  }

  callback();
}

/**
 * Checks if user has previously authenticated.
 * @return {Promise<boolean>} A promise that resloves to true if
 * user is authenticated or false if not.
 */
async function isLoggedIn() {
  return chrome.storage.local.get({
    'UserID': 'None',
  })
      .then((storage) => {
      // If we have a UserID then the user has authenticated.
        if (storage.UserID !== 'None') {
          return true;
        } else {
          return false;
        }
      });
}

/**
 * Processes text the user's selected Text-To-Speech model.
 * @param {string} text The text to be spoken.
 * @return {Promise}
 */
async function handleTextToSpeech(text) {
  return await chrome.storage.sync.get(
      {
        'TTS': 'tts-1',
        'Voice': 'alloy',
        'TTSEnabled': true,
      })
      .then((syncStorage) => {
        syncStorage.TTS = syncStorage.TTS.toString().toLowerCase();
        syncStorage.Voice = syncStorage.Voice.toString().toLowerCase();
        return syncStorage;
      })
      .then(async (syncStorage) => {
        if (!syncStorage.TTSEnabled) {
          return;
        }
        if (syncStorage.TTS == 'tts-1' || syncStorage.TTS == 'tts-1-hd') {
          openAITextToSpeech(text, syncStorage.TTS, syncStorage.Voice);
        } else if (syncStorage.TTS == 'tts-chrome') {
          chromeTextToSpeech(text);
        }
      });
}

          }
        );
      }
    });
}

// Returns current GPT Instructions.
async function getGPTInstructions() {
  return await chrome.storage.sync.get({
    "Persona": "mentor",
    "BotAction": "explain the concept of the text",
    "ReadingLevel": "beginner",
    "WordLimit": "30",
  })
    .then((botOptions) => {
      if (Number.isNaN(botOptions.WordLimit)) {
        throw new Error("Saved word limit is not a number");
      }
      botOptions.Persona = botOptions.Persona.toString().toLowerCase();
      botOptions.BotAction = botOptions.BotAction.toString().toLowerCase();
      botOptions.ReadingLevel = botOptions.ReadingLevel.toString().toLowerCase();
      return botOptions;
    })
    .then((botOptions) => {
      return `You are a/an ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a/an ${botOptions.ReadingLevel} level of the topic. 
              Limit responses to ${botOptions.WordLimit} words. In the event that you can not provide an answer, only apologize and ask for more context.`;
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
        throw new Error(`Fetch Failed: ${response.statusText} Status: ${response.status}`);
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
      console.error("Failed to send completion request to GPT -", err);
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
    return await chrome.storage.sync.get({ "GPT": "gpt-3.5-turbo-1106" }).then(async (syncStorage) => {
      return await fetchCompletionRequestToGPT(instructions, syncStorage.GPT, text, storage.OpenAIKey);
    }).catch((err) => {
      console.err("Could not retrive selected GPT model from storage -", err);
    });
  })
    .catch(async (err) => {
      console.error("Could not retrieve API Key from storage -", err)
      await sendNotification({
        title: "Simply Explain - Error", 
        type: "basic", 
        message: "Please set an API Key in the options menu - " + err, 
        requireInteraction: false,
      });
    });
}

// Processes text through GPT then provides the result via TTS.
async function processText(text) {
  await getCompletionResults(text).then(async (data) => {
    if (!data) {
      throw new Error("No completion result found.");
    }
    if (!data.choices) {
      throw new Error("No completion choices found.");
    }
    await sendNotification({
      title: "Simply Explain (Hover for full message)", 
      type: "basic", 
      message: data.choices[0].message.content, 
      requireInteraction: true,
      buttons: [{ title: "Close" }]
    });
    await textToSpeech(data.choices[0].message.content);
  })
    .catch((err) => {
      console.error("Could not process text -", err);
    });
}

async function sendNotification(options) {
  return chrome.notifications.create({
    iconUrl: chrome.runtime.getURL("images/person-raised-hand128.png"),
    title: options.title,
    type: options.type,
    message: options.message,
    requireInteraction: options.requireInteraction,
    buttons: options.buttons
  })
    .catch((err) => {
      console.error("Failed to send notifcation -", err);
    });
}

// Opens the admin panel as a new tab to the current window.
async function openAdminPanel() {
  let currentTab = await chrome.tabs.query({ active: true });
  chrome.tabs.create({
    active: true,
    url: chrome.runtime.getURL("../pages/admin-panel.html"),
    windowId: currentTab[0].windowId
  });
}

// Converts blob to json.stringify()-able format then sends it to offscreen.
function sendBlobToOffscreen(blob) {
  var reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = async function sendDataURLContentToOffscreen() {
    if (!reader.result) {
      return;
    }
    var base64String = reader.result.split(',')[1];
    chrome.runtime.sendMessage({
      text: base64String,
      target: 'offscreen',
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to send message to offscreen document -", chrome.runtime.lastError.message);
        return;
      }
      console.log(response);
    })
  };
}

function uninstall() {
  chrome.management.uninstallSelf({
    showConfirmDialog: true
  });
}

setupExtension();