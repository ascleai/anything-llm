import { chatPrompt } from "@/utils/chat";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";

export default function ChatPromptSettings({ workspace, settings, setHasChanges }) {
  const { t } = useTranslation();
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    // settings가 있고, DefaultPrompt 필드가 있을 때만 설정
    if (settings && (workspace?.openAiPrompt || settings.DefaultPrompt)) {
      const newPromptValue = workspace?.openAiPrompt ?? settings.DefaultPrompt ?? chatPrompt(workspace);
      setPromptText(newPromptValue);
    }
  }, [workspace?.openAiPrompt, settings]); 

  const handleTextChange = (e) => {
    setPromptText(e.target.value);
    setHasChanges(true);
  };

  return (
    <div>
      <div className="flex flex-col">
        <label htmlFor="name" className="block input-label">
          {t("chat.prompt.title")}
        </label>
        <p className="text-white text-opacity-60 text-xs font-medium py-1.5">
          {t("chat.prompt.description")}
        </p>
      </div>
      <textarea
        name="openAiPrompt"
        rows={5}
        value={promptText}
        className="border-none bg-theme-settings-input-bg placeholder:text-theme-settings-input-placeholder text-white text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5 mt-2"
        placeholder="Given the following conversation, relevant context, and a follow up question, reply with an answer to the current question the user is asking. Return only your response to the question given the above information following the users instructions as needed."
        required={true}
        wrap="soft"
        autoComplete="off"
        onChange={handleTextChange}
      />
    </div>
  );
}
