// ⚡ 这里我们直接用全局变量导入，不需要 import 语法（因为 Netlify 默认是普通 JS 运行环境）

// 生成报告
document.getElementById("generateBtn").addEventListener("click", async () => {
  const loadingMsg = document.getElementById("loadingMsg");
  loadingMsg.style.display = "inline";  // 显示加载中

  try {
    const inputText = document.getElementById("inputText").value;

    // 调用 AI 服务
    const report = await callAIModel(inputText);

    document.getElementById("result").value = report;
  } catch (error) {
    document.getElementById("result").value = "❌ 报告生成失败，请稍后再试。";
  } finally {
    loadingMsg.style.display = "none";  // 隐藏加载提示
  }
});

// 复制结果
document.getElementById("copyBtn").addEventListener("click", () => {
  const resultText = document.getElementById("result").value;
  navigator.clipboard.writeText(resultText).then(() => {
    const copyMsg = document.getElementById("copyMsg");
    copyMsg.style.display = "inline";
    setTimeout(() => (copyMsg.style.display = "none"), 2000);
  });
});

// 提交反馈
document.getElementById("feedbackForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const feedback = document.getElementById("feedback").value.trim();
  const feedbackMsg = document.getElementById("feedbackMsg");

  // 邮箱校验
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !feedback) {
    alert("请填写完整内容！");
    return;
  }
  if (!emailRegex.test(email)) {
    alert("请输入有效的邮箱！");
    return;
  }

  // 模拟提交
  await new Promise((resolve) => setTimeout(resolve, 1000));
  feedbackMsg.style.display = "inline";

  setTimeout(() => (feedbackMsg.style.display = "none"), 3000);
  document.getElementById("feedbackForm").reset();
});

// ✅ 这里引用我们新建的 services/aiModel.js
async function callAIModel(prompt) {
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
