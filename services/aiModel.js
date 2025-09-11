// services/aiModel.js
export async function callAIModel(prompt) {
  try {
    const response = await fetch("https://api.gmini.ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error("API 调用失败");

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("AI 调用错误:", error);
    throw error;
  }
}
