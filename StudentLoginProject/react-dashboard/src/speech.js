let activeUtterance = null;
let activeOnStateChange = null;

export function isSpeechSynthesisAvailable() {
  return typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance === "function";
}

export function stopSpeaking() {
  if (!isSpeechSynthesisAvailable()) return;

  const onStateChange = activeOnStateChange;
  activeUtterance = null;
  activeOnStateChange = null;
  window.speechSynthesis.cancel();
  onStateChange?.(false);
}

export function speakText(text, onStateChange = () => {}) {
  if (!isSpeechSynthesisAvailable()) return false;

  stopSpeaking();
  const utterance = new window.SpeechSynthesisUtterance(text);
  activeUtterance = utterance;
  activeOnStateChange = onStateChange;
  utterance.onstart = () => onStateChange(true);
  utterance.onend = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    activeOnStateChange = null;
    onStateChange(false);
  };
  utterance.onerror = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    activeOnStateChange = null;
    onStateChange(false);
  };
  window.speechSynthesis.speak(utterance);
  return true;
}
