window.addEventListener('load', () => {
  const speakAgainBtn = document.getElementById('speak-again-btn');
  const adminPanelBtn = document.getElementById('admin-panel-btn');

  speakAgainBtn.addEventListener('click', speakPreviousRequest);
  adminPanelBtn.addEventListener('click', openAdminPanel);

  chrome.runtime.onMessage.addListener(handleMessages);

  /**
 * Handles incoming messages from chrome.runtime.
 * @param {*} message Received message.
 * @param {chrome.runtime.MessageSender} sender Message sender.
 * @param {Function} sendResponse Callback to send a response.
 * @return {void}
 */
  async function handleMessages(message, sender, sendResponse) {
    if (message.target != 'chat-history') {
      return;
    }
    if (message.type === 'updateHistory') {
      await updateHistory();
      return;
    }
  }

  /**
   * Loads the chat history from storage.
   * @return {Promise} A promise containing the storage object.
   */
  async function loadHistory() {
    try {
      return await chrome.storage.local.get(['History']);
    } catch (err) {
      console.error('Could not load chat history -', err);
    }
  }

  /**
   * Updates the front-end history textarea element.
   */
  async function updateHistory() {
    const storage = await loadHistory();
    const history = storage.History;
    const historyCards = document.getElementById("history-container").children;

    if (history.length < 1) {
      console.log("No history found.");
      return;
    }

    for (let i = 0; i < history.length; i++) {
      if (i >= historyCards.length)
      {
        break;
      }

      historyCards[i].getElementsByTagName("h4")[0].textContent = history[i].user;
      historyCards[i].getElementsByTagName("p")[0].textContent = history[i].response;
    }
  }

  /**
   * Requests service worker to replay last request.
   */
  async function speakPreviousRequest() {
    try {
      if (!loadHistory()) {
        return;
      }
      await chrome.runtime.sendMessage({
        text: 'speaks last message',
        type: 'speakAgain',
        target: 'service-worker',
      });
    } catch (err) {
      console.error('Could not send request to speak last message -', err);
    }
  }

  /**
   * Requests the service worker to open the admin panel.
   */
  async function openAdminPanel() {
    try {
      await chrome.runtime.sendMessage({
        text: 'open admin panel',
        type: 'openAdminPanel',
        target: 'service-worker',
      });
    } catch (err) {
      console.error('Could not send request to open admin panel -', err);
    }
  }


  updateHistory();
});
