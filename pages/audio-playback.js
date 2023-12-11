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

  const audioBlob = base64StringToBlob(message.text);
  playAudioBlob(audioBlob);

  sendResponse('Message recieved');
}

/**
 * Converts Base64String content into audioblob.
 * @param {string} base64String Mp3 string content to convert.
 * @return {Blob} Blob of type 'audio/mpeg'.
 */
function base64StringToBlob(base64String) {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], {type: 'audio/mpeg'});
}

/**
 * Plays an audio blob using an audio element.
 * @param {Blob} audioBlob Blob of type 'audio/mpeg' to play.
 */
function playAudioBlob(audioBlob) {
  const audioElement = document.getElementById('audio');
  audioElement.setAttribute('src', URL.createObjectURL(audioBlob));
  audioElement.setAttribute('type', 'audio/mpeg');
  audioElement.play();
}
