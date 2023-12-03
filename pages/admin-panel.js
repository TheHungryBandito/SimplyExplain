window.onload = () => {
    const savePromptBtn = document.getElementById("save-prompt-btn")
    const saveOptionsBtn = document.getElementById("save-options-btn");
    const ttsEnabled = document.getElementById("tts-enabled");
    const ttsModel = document.getElementById("tts-model");
    savePromptBtn.addEventListener("click", savePrompt)
    saveOptionsBtn.addEventListener("click", saveOptions);
    ttsEnabled.addEventListener("click", updateTTSOptions);
    ttsModel.addEventListener("input", updateTTSOptions);

    // Navbar
    const dashboardBtn = document.getElementById("dashboard-btn");
    const uninstallBtn = document.getElementById("uninstall-btn");
    dashboardBtn.addEventListener("click", location.reload);
    uninstallBtn.addEventListener("click", uninstall);
    
    function updateTTSOptions() {
        if (ttsEnabled.checked)
        {
            document.getElementById("tts-model").disabled = false;
            document.getElementById("tts-voice").disabled = false;
        } else {
            document.getElementById("tts-model").disabled = true;
            document.getElementById("tts-voice").disabled = true;
        }

        if (ttsModel.value == "tts-chrome")
        {
            document.getElementById("tts-voice").disabled = true;
        }
    }

    function loadOptions()
    {
        chrome.storage.local.get(["OpenAIKey"]).then((storage) => {
            if (storage.OpenAIKey)
            {
                document.getElementById("api-key").value = storage.OpenAIKey;
            }
        });

        chrome.storage.sync.get(
            {
                "ReadingLevel": "unset",
                "Persona": "unset",
                "BotAction": "unset",
                "WordLimit": "unset",
                "TTS": "unset",
                "GPT": "unset",
                "Voice": "unset",
                "TTSEnabled": "unset"
            },
            function updateOptionFields(botOptions) {
                // Only set if values are found in storage, so placeholders take place.
                if (botOptions.ReadingLevel != "unset")
                {
                    document.getElementById("reading-level").value = botOptions.ReadingLevel;
                }
                if (botOptions.Persona != "unset")
                {
                    document.getElementById("persona").value = botOptions.Persona;
                }
                if (botOptions.BotAction != "unset")
                {
                    document.getElementById("action").value = botOptions.BotAction;
                }
                if (botOptions.WordLimit != "unset")
                {
                    document.getElementById("word-limit").value = botOptions.WordLimit;
                }
                if (botOptions.TTS != "unset")
                {
                    document.getElementById("tts-model").value = botOptions.TTS;
                }
                if (botOptions.GPT != "unset")
                {
                    document.getElementById("gpt-model").value = botOptions.GPT;
                }
                if (botOptions.Voice != "unset")
                {
                    document.getElementById("tts-voice").value = botOptions.Voice;
                }
                if (botOptions.TTSEnabled != "unset")
                {
                    ttsEnabled.checked = botOptions.TTSEnabled;
                    updateTTSOptions();
                }
            }
        );
    }

    function saveOptions() {
        const key = document.getElementById("api-key");
        const ttsVoice = document.getElementById("tts-voice");
        const gptModel = document.getElementById("gpt-model");

        chrome.storage.local.set({ OpenAIKey: key.value });

        chrome.storage.sync.set({
            TTS: ttsModel.value.toString().toLowerCase(),
            GPT: gptModel.value.toString().toLowerCase(),
            Voice: ttsVoice.value.toString().toLowerCase(),
            TTSEnabled: ttsEnabled.checked
        },
        function () {
            loadOptions();
        });
    }
    
    // Saves extensions settings
    function savePrompt() {
        const readingLevel = document.getElementById("reading-level");
        const persona = document.getElementById("persona");
        const botAction = document.getElementById("action");
        const wordLimit = document.getElementById("word-limit");
        
        if (Number.isNaN(wordLimit.value))
        {
            console.log('Word limit is not a number, please use a real number');
            return false;
        }

        chrome.storage.sync.set({
            ReadingLevel: readingLevel.value.toString().toLowerCase(),
            BotAction: botAction.value.toString().toLowerCase(),
            Persona: persona.value.toString().toLowerCase(),
            WordLimit: wordLimit.value,
        },
        function () {
            updatePrompt();
        });
    }

    // Uninstalls the chrome extension from the user's browser
    function uninstall() {
        chrome.management.uninstallSelf({
            showConfirmDialog: true
        });
    }

    function updatePrompt() {
        const prompt = document.getElementById("prompt");
        chrome.storage.sync.get(
            {
                "Persona": "teacher",
                "BotAction": "explain the concept of the text",
                "ReadingLevel": "beginner",
                "WordLimit": "30",
            }, function (botOptions) {
                prompt.textContent = ` You are a/an ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a/an ${botOptions.ReadingLevel} level of the topic. 
                Limit responses to ${botOptions.WordLimit} words.`;
            }
        );
    }

    loadOptions();
    updatePrompt();
};
