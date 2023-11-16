window.onload = () => {
    const saveBtn = document.getElementById("save-btn");
    saveBtn.addEventListener("click", save);

    // Navbar
    const dashboardBtn = document.getElementById("dashboard-btn");
    const uninstallBtn = document.getElementById("uninstall-btn");
    dashboardBtn.addEventListener("click", location.reload);
    uninstallBtn.addEventListener("click", uninstall);

    chrome.storage.local.get({"OpenAIKey": "unset"}, function loadKey(storage) {
        if (storage.OpenAIKey == "unset")
        {
            return;
        }
        document.getElementById("api-key").value = storage.OpenAIKey;
    });

    chrome.storage.sync.get(
        {
            "ReadingLevel": "unset",
            "Persona": "unset",
            "BotAction": "unset",
            "WordLimit": "unset"
        },
        function updateOptions(botOptions) {
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
        }
    );

    // Saves extensions settings
    function save() {
        const key = document.getElementById("api-key");
        const readingLevel = document.getElementById("reading-level");
        const persona = document.getElementById("persona");
        const botAction = document.getElementById("action");
        const wordLimit = document.getElementById("word-limit");

        if (Number.isNaN(wordLimit.value))
        {
            console.log('Word limit is not a number, please use a real number');
            return;
        }

        chrome.storage.local.set({ OpenAIKey: key.value });

        chrome.storage.sync.set({
            ReadingLevel: readingLevel.value.toLowerCase(),
            BotAction: botAction.value.toLowerCase(),
            Persona: persona.value.toLowerCase(),
            WordLimit: wordLimit.value
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
                "WordLimit": "30"
            }, function (botOptions) {
                // Ensure that 'a' and 'an' are used correctly
                if (botOptions.ReadingLevel == "beginner")
                {
                    prompt.innerText = `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at a ${botOptions.ReadingLevel} level. 
                    Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
                }
                else
                {
                    prompt.innerText = `You are a ${botOptions.Persona} and ${botOptions.BotAction} the user provides at an ${botOptions.ReadingLevel} level. 
                    Limit responses to ${botOptions.WordLimit} words. If more text is needed, say "I need more text to complete this action.".`;
                }
            }
        );
    }

    updatePrompt();
};
