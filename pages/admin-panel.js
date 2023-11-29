window.onload = () => {
    const saveBtn = document.getElementById("save-btn");
    saveBtn.addEventListener("click", save);

    // Navbar
    const dashboardBtn = document.getElementById("dashboard-btn");
    const uninstallBtn = document.getElementById("uninstall-btn");
    dashboardBtn.addEventListener("click", location.reload);
    uninstallBtn.addEventListener("click", uninstall);

    loadOptions();


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
                "Voice": "unset"
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
            }
        );
    }

    // Saves extensions settings
    function save() {
        const key = document.getElementById("api-key");
        const readingLevel = document.getElementById("reading-level");
        const persona = document.getElementById("persona");
        const botAction = document.getElementById("action");
        const wordLimit = document.getElementById("word-limit");
        const ttsModel = document.getElementById("tts-model");
        const ttsVoice = document.getElementById("tts-voice");
        const gptModel = document.getElementById("gpt-model");

        if (Number.isNaN(wordLimit.value))
        {
            console.log('Word limit is not a number, please use a real number');
            return false;
        }

        chrome.storage.local.set({ OpenAIKey: key.value });

        chrome.storage.sync.set({
            ReadingLevel: readingLevel.value.toString().toLowerCase(),
            BotAction: botAction.value.toString().toLowerCase(),
            Persona: persona.value.toString().toLowerCase(),
            WordLimit: wordLimit.value,
            TTS: ttsModel.value.toString().toLowerCase(),
            GPT: gptModel.value.toString().toLowerCase(),
            Voice: ttsVoice.value.toString().toLowerCase()
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
                // Ensure that 'a' and 'an' are used correctly
                if (botOptions.ReadingLevel == "beginner")
                {
                    prompt.textContent = `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a ${botOptions.ReadingLevel} level. 
                    Limit responses to ${botOptions.WordLimit} words.`;
                }
                else
                {
                    prompt.textContent = `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at an ${botOptions.ReadingLevel} level. 
                    Limit responses to ${botOptions.WordLimit} words.`;
                }
            }
        );
    }

    updatePrompt();
};
