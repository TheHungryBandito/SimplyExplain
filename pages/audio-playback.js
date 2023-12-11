chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Handles incoming messages from chrome.runtime.
 * @param {*} message Received message.
 * @param {chrome.runtime.MessageSender} sender Message sender.
 * @param {Function} sendResponse Callback to send a response.
 * @return {void}
 */
function handleMessages(message, sender, sendResponse) {
  if (message.target != 'offscreen') {
    return;
  }

    const base64String = message.text;
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });

    const audioElement = document.getElementById("audio");
    audioElement.setAttribute("src", URL.createObjectURL(audioBlob));
    audioElement.setAttribute("type", 'audio/mpeg');
    audioElement.play();

    sendResponse("Message recieved");
}