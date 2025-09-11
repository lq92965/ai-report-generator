// script.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// ✅ 从 Netlify 环境变量中读取 API Key
const genAI = new GoogleGenerativeAI(window.GEMINI_API_KEY || "YOUR_API_KEY");

// 选择模型
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 获取页面元素
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const inputText = document.getElementById("inputText");
const resultBox = document.getElementById("result");
const loadingMsg = document.getElementById("loadingMsg");
const copyMsg = document.getElementById("copyMsg");
const errorMsg = document.getElementById("errorMsg");

const languageSelect = document.getElementById("languageSelect");
const toneSelect = document.getElementById("toneSelect");
const lengthSelect = document.getElementById("lengthSelect");

// 生成报告
generateBtn.addEventListener("click", async () => {
  const userInput = inputText.value.trim();
  if (!userInput) {
    errorMsg.style.display = "block";
    errorMsg.textContent = "请输入内容再生成报告";
    return;
  }

  errorMsg.style.display = "none";
  loadingMsg.style.display = "inline";

  const lang = languageSelect.value;
  const tone = toneSelect.value;
  const length = lengthSelect.value;

  const prompt = `
Generate a ${length} report in ${lang}.
Tone/style: ${tone}.
Content:
${userInput}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    resultBox.value = text;
  } catch (err) {
    console.error(err);
    errorMsg.style.display = "block";
    errorMsg.textContent = "生成报告时出错，请稍后再试。";
  } finally {
    loadingMsg.style.display = "none";
  }
});

// 复制报告
copyBtn.addEventListener("click", async () => {
  if (!resultBox.value) return;
  await navigator.clipboard.writeText(resultBox.value);
  copyMsg.style.display = "inline";
  setTimeout(() => (copyMsg.style.display = "none"), 2000);
});

// 反馈表单
document.getElementById("feedbackForm").addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.reset();
  document.getElementById("feedbackMsg").style.display = "inline";
  setTimeout(() => {
    document.getElementById("feedbackMsg").style.display = "none";
  }, 3000);
});
