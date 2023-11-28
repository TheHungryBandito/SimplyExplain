let nonce = Math.random().toString(36).substring(2, 15);
let isLoggedIn = false; // Default false
let creatingOffscreen;

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
          return await fetch(
            new URL("https://api.openai.com/v1/audio/speech"), {
            method: 'POST',
            headers: {
              'Authorization': "Bearer " + storage.OpenAIKey,
              'Content-Type': "application/json"
            },
            body: JSON.stringify({
              "model": syncStorage.TTS.toString(),
              "input": text.toString(),
              "voice": syncStorage.Voice.toString()
            })
          })
            .then((response) => {
              if (!response.ok) {
                console.error("Fetch request failed - Status: ", response.status);
                return response;
              }
              return response.json();
            })
            .then((data) => {
              console.log(data);
            }).catch((err) => {
              console.error('Failure fetching TTS:', err);
            })
        });
      }
      else if (syncStorage.TTS == "tts-chrome")
      {
        chrome.tts.stop();
        return chrome.tts.speak(
          text,
          { 'lang': 'en-US' },
          function () {
            if (chrome.runtime.lastError) {
              console.error('Error: ' + chrome.runtime.lastError.message);
            }
          }
        );
      }
    });

}

async function sendRequestToGPT(text) {
  return await chrome.storage.sync.get({
    "Persona": "teacher",
    "BotAction": "explain the concept of the text",
    "ReadingLevel": "beginner",
    "WordLimit": "30"
  }).then(function (botOptions) {
    // Ensure that 'a' and 'an' are used correctly
    if (botOptions.ReadingLevel == "beginner") {
      return `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a ${botOptions.ReadingLevel} level. 
      Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
    }
    else {
      return `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at an ${botOptions.ReadingLevel} level. 
      Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
    }
  }
  ).then(async function (instructions) {
    return await chrome.storage.local.get(["OpenAIKey"]).then(async (storage) => {
      return await fetch(
        new URL("https://api.openai.com/v1/chat/completions"), {
        method: 'POST',
        headers: {
          'Authorization': "Bearer " + storage.OpenAIKey,
          'Content-Type': "application/json"
        },
        body: JSON.stringify({
          "model": "gpt-4",
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
      }).then(response => {
        if (!response.ok) {
          console.error("Fetch request failed - Status: ", response.status);
          return false;
        }
        return response.json();
      }).then(data => {
        if (data.error) {
          console.error("API Error");
          return false;
        }
        if (!data.choices[0]) {
          console.error("No response");
          return false;
        }
        return data;
      });
    }).catch((reason) => {
      console.error('error', reason);
      return reason;
    });
  });
}

// Speaks the explanation returned from GPT model
async function processText(text) {
  await sendRequestToGPT(text).then(data => {
    console.log(data.choices[0].message.content);
    speakText(data.choices[0].message.content);
  });
}

// Uninstalls the chrome extension from the user's browser
function uninstall() {
  chrome.management.uninstallSelf({
    showConfirmDialog: true
  });
}

async function auth() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  let clientID = '849293445118-toonlns3d7fmocfcn4g8qvoc49neqmhn.apps.googleusercontent.com';
  let redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;

  authUrl.searchParams.set('client_id', clientID);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('prompt', 'consent');

  return chrome.identity.launchWebAuthFlow({
    url: authUrl.href,
    interactive: true,

  }).then((url) => {
    if (url) {
      isLoggedIn = true;
    }
  }).catch((err) => {
    console.error("Failure in WebAuthFlow:", err);
  });
}

// Authenticates user then runs callback.
async function authFlow(callback) {
  if (!isLoggedIn)
  {
    auth().then((result) => {
      callback();
    }).catch((err) => {
      console.error('Failure to authenticate:', err);
    });
    return;
  }

  callback();
}

async function openAdminPanel() {
  let currentTab = await chrome.tabs.query({ active: true });
  chrome.tabs.create({
    active: true,
    url: chrome.runtime.getURL("../pages/admin-panel.html"),
    windowId: currentTab[0].windowId
  });
}

function main() {
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

  // Recieve the selected text
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

  chrome.commands.onCommand.addListener((command) => {
    getCurrentTabId().then((id) => {
      chrome.scripting.executeScript({
        target: { tabId: id },
        func: relaySelectedText
      });
    });
  });

  chrome.action.onClicked.addListener(function () {
    authFlow(openAdminPanel);
  });
}

main();




