chrome.runtime.onMessage.addListener(handleMessages);

function handleMessages(message, sender, sendResponse)
{
    if (message.target != 'offscreen') {
        console.log("Failed");
        return;
    }

    const base64String = message.text;
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++)
    {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], {type: 'audio/mpeg'});

    const audioElement = document.getElementById("audio");
    const sourceElement = document.getElementById("audio-src");
    sourceElement.setAttribute("src", URL.createObjectURL(audioBlob));
    sourceElement.setAttribute("type", 'audio/mpeg');
    audioElement.appendChild(sourceElement);
    audioElement.play();

    sendResponse(URL.createObjectURL(audioBlob));
}