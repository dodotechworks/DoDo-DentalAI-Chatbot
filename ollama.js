import fetch from "node-fetch"

export async function askOllama(message, systemPrompt) {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen2.5:0.5b",
      prompt: `${systemPrompt}\nUser: ${message}\nAssistant:`,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error("Ollama request failed")
  }

  const data = await response.json()
  return data.response
}
