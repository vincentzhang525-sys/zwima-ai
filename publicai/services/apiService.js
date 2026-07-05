(function () {
  async function getDb() {
    await window.ZwimaDatabase.init();
    return window.ZwimaDatabase.getRepositories();
  }

  function buildCodeExamples(url) {
    return {
      Python: `import requests\n\nresponse = requests.post(\n    "${url}",\n    headers={"Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json"},\n    json={"model": "openai/gpt-5", "messages": [{"role": "user", "content": "Hello, ZWIMA AI."}], "temperature": 0.7, "max_tokens": 2048},\n)\nprint(response.json())`,
      JavaScript: `const response = await fetch("${url}", {\n  method: "POST",\n  headers: { Authorization: "Bearer YOUR_API_KEY", "Content-Type": "application/json" },\n  body: JSON.stringify({ model: "openai/gpt-5", messages: [{ role: "user", content: "Hello, ZWIMA AI." }], temperature: 0.7, max_tokens: 2048 }),\n});\nconst data = await response.json();\nconsole.log(data);`,
      PHP: `<?php\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ["Authorization: Bearer YOUR_API_KEY", "Content-Type: application/json"], CURLOPT_POSTFIELDS => json_encode(["model" => "openai/gpt-5", "messages" => [["role" => "user", "content" => "Hello, ZWIMA AI."]], "temperature" => 0.7, "max_tokens" => 2048])]);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;`,
      Curl: `curl ${url} \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"openai/gpt-5","messages":[{"role":"user","content":"Hello, ZWIMA AI."}],"temperature":0.7,"max_tokens":2048}'`,
      Go: `package main\n\nimport ("bytes"; "encoding/json"; "net/http")\n\nfunc main() {\n  body, _ := json.Marshal(map[string]interface{}{"model": "openai/gpt-5", "messages": []map[string]string{{"role": "user", "content": "Hello, ZWIMA AI."}}, "temperature": 0.7, "max_tokens": 2048})\n  req, _ := http.NewRequest("POST", "${url}", bytes.NewBuffer(body))\n  req.Header.Set("Authorization", "Bearer YOUR_API_KEY")\n  req.Header.Set("Content-Type", "application/json")\n  client := &http.Client{}\n  resp, _ := client.Do(req)\n  defer resp.Body.Close()\n}`,
      Java: `HttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder().uri(URI.create("${url}")).header("Authorization", "Bearer YOUR_API_KEY").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{\\"model\\":\\"openai/gpt-5\\"}")).build();\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());`,
      "C#": `using var client = new HttpClient();\nclient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "YOUR_API_KEY");\nvar payload = new { model = "openai/gpt-5", messages = new[] { new { role = "user", content = "Hello, ZWIMA AI." } }, temperature = 0.7, max_tokens = 2048 };\nvar response = await client.PostAsync("${url}", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));`,
    };
  }

  window.ZwimaApiService = {
    getEndpoint() {
      return getDb().then((db) => db.settings.getGatewayEndpoint());
    },
    getGatewayProviders() {
      return getDb().then((db) => db.logs.getGatewayProviders());
    },
    async getHealth() {
      const db = await getDb();
      const [serviceHealth, dbHealth] = await Promise.all([db.logs.getHealth(), window.ZwimaDatabase.getHealth()]);
      return [...serviceHealth, ...dbHealth.items];
    },
    getRateLimits() {
      return getDb().then((db) => db.logs.getRateLimits());
    },
    getRequestLogs() {
      return getDb().then((db) => db.logs.getRequestLogs());
    },
    getCodeExamples() {
      return this.getEndpoint().then((url) => buildCodeExamples(url));
    },
    getGatewayStatistics() {
      return getDb().then((db) => db.logs.getGatewayStatistics());
    },
    runPlayground(payload) {
      return window.ZwimaDatabase.queryApi("/api/playground/run", "POST", payload).then((r) => r.data);
    },
    getDatabaseHealth() {
      return window.ZwimaDatabase.getHealth();
    },
    downloadSdk() {
      return getDb().then((db) => db.logs.getSdkMessage().then((message) => ({ message })));
    },
  };
})();
