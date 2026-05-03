async function submitAuth(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector(".error");
  error.textContent = "";
  const payload = Object.fromEntries(new FormData(form).entries());
  const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Something went wrong" }));
    error.textContent = data.detail || "Something went wrong";
    return;
  }

  window.location.href = "/app";
}
